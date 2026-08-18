import os
import sys
import json
import time
import threading
import requests

# Fix Windows cp1252 encoding crashes when printing Unicode/emoji
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr.encoding != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, session, jsonify, Response, send_from_directory, stream_with_context, flash
from flask_session import Session
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash
import firebase_admin
from firebase_admin import credentials, firestore, auth as fb_auth

from utils.ai_processor import extract_text_from_pdf, generate_syllabus, process_chapter, call_llm
from utils.tts_engine import generate_chapter_audio_stream, get_voice_for_language
from utils.story_generator import generate_manga_story, generate_manga_images_batch, generate_simplified_content

load_dotenv(override=True)

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "neurolearn_super_secret_key_123")

# Session Config
app.config["SESSION_TYPE"] = "filesystem"
app.config["SESSION_PERMANENT"] = False
Session(app)

# --- FIREBASE ADMIN SDK INITIALIZATION ---
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "neurolearn-d9491")
FIREBASE_API_KEY = os.getenv("FIREBASE_API_KEY", "AIzaSyA_82lrODFlAby8lfF2TXW45-9dGBt_ZUE")
REST_BASE_URL = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents"

def py_to_firestore(val):
    if val is None: return {'nullValue': None}
    elif isinstance(val, bool): return {'booleanValue': val}
    elif isinstance(val, int): return {'integerValue': str(val)}
    elif isinstance(val, float): return {'doubleValue': val}
    elif isinstance(val, str): return {'stringValue': val}
    elif isinstance(val, list): return {'arrayValue': {'values': [py_to_firestore(x) for x in val]}}
    elif isinstance(val, dict): return {'mapValue': {'fields': {k: py_to_firestore(v) for k, v in val.items()}}}
    return {'stringValue': str(val)}

def firestore_to_py(val):
    if not isinstance(val, dict): return None
    if 'stringValue' in val: return val['stringValue']
    elif 'integerValue' in val: return int(val['integerValue'])
    elif 'doubleValue' in val: return float(val['doubleValue'])
    elif 'booleanValue' in val: return val['booleanValue']
    elif 'nullValue' in val: return None
    elif 'mapValue' in val: return {k: firestore_to_py(v) for k, v in val.get('mapValue', {}).get('fields', {}).items()}
    elif 'arrayValue' in val: return [firestore_to_py(x) for x in val.get('arrayValue', {}).get('values', [])]
    return None

class MemoryDoc:
    def __init__(self, doc_id, data):
        self.id = str(doc_id)
        self._data = data or {}
        self.exists = data is not None and bool(data)
    def to_dict(self):
        return dict(self._data)
    def get(self, key, default=None):
        return self._data.get(key, default)

class MemoryQuery:
    def __init__(self, items):
        self._items = items
    def order_by(self, field, direction=None):
        return self
    def limit(self, count):
        self._items = self._items[:count]
        return self
    def get(self):
        return self._items
    def __len__(self):
        return len(self._items)
    def __iter__(self):
        return iter(self._items)

class RESTDocumentRef:
    def __init__(self, store, collection_name, doc_id):
        self._store = store
        self.collection_name = collection_name
        self.id = str(doc_id)
        self.url = f"{REST_BASE_URL}/{self.collection_name}/{self.id}?key={FIREBASE_API_KEY}"

    def get(self):
        cached = self._store.get_cached(self.collection_name, self.id)
        if cached is not None:
            return MemoryDoc(self.id, cached)
        try:
            r = requests.get(self.url, timeout=5)
            if r.status_code == 200:
                fields = r.json().get('fields', {})
                data = {k: firestore_to_py(v) for k, v in fields.items()}
                self._store.set_cached(self.collection_name, self.id, data)
                return MemoryDoc(self.id, data)
        except Exception as e:
            print(f"⚠️ [FIRESTORE REST] Get error: {e}")
        return MemoryDoc(self.id, None)

    def set(self, data, merge=False):
        existing = self._store.get_cached(self.collection_name, self.id) or {}
        new_data = {**existing, **data} if merge else dict(data)
        self._store.set_cached(self.collection_name, self.id, new_data)
        try:
            fields = {k: py_to_firestore(v) for k, v in new_data.items()}
            requests.patch(self.url, json={'fields': fields}, timeout=5)
        except Exception as e:
            print(f"⚠️ [FIRESTORE REST] Set error: {e}")

    def update(self, data):
        self.set(data, merge=True)

    def delete(self):
        self._store.delete_cached(self.collection_name, self.id)
        try:
            requests.delete(self.url, timeout=5)
        except Exception as e:
            print(f"⚠️ [FIRESTORE REST] Delete error: {e}")

class RESTCollection:
    def __init__(self, store, name):
        self._store = store
        self.name = name

    def document(self, doc_id=None):
        if not doc_id:
            import uuid
            doc_id = str(uuid.uuid4())
        return RESTDocumentRef(self._store, self.name, str(doc_id))

    def where(self, field, op, val):
        docs = self.get()
        matches = []
        for d in docs:
            field_val = d.to_dict().get(field)
            if op in ('==', 'equal'):
                if field_val == val or str(field_val) == str(val):
                    matches.append(d)
        return MemoryQuery(matches)

    def add(self, data):
        import uuid
        doc_id = str(uuid.uuid4())
        ref = self.document(doc_id)
        ref.set(data)
        return ref

    def get(self):
        docs = []
        try:
            url = f"{REST_BASE_URL}/{self.name}?key={FIREBASE_API_KEY}"
            r = requests.get(url, timeout=5)
            if r.status_code == 200:
                raw_docs = r.json().get('documents', [])
                for rd in raw_docs:
                    name_parts = rd.get('name', '').split('/')
                    d_id = name_parts[-1] if name_parts else 'unknown'
                    fields = rd.get('fields', {})
                    data = {k: firestore_to_py(v) for k, v in fields.items()}
                    self._store.set_cached(self.name, d_id, data)
                    docs.append(MemoryDoc(d_id, data))
                return docs
        except Exception as e:
            print(f"⚠️ [FIRESTORE REST] List error: {e}")
        cached_coll = self._store._cache.get(self.name, {})
        return [MemoryDoc(k, v) for k, v in cached_coll.items()]

    def list_documents(self):
        docs = self.get()
        return [RESTDocumentRef(self._store, self.name, d.id) for d in docs]

class ResilientRESTFirestore:
    def __init__(self):
        self._cache = {}

    def get_cached(self, collection, doc_id):
        return self._cache.get(collection, {}).get(str(doc_id))

    def set_cached(self, collection, doc_id, data):
        if collection not in self._cache:
            self._cache[collection] = {}
        self._cache[collection][str(doc_id)] = data

    def delete_cached(self, collection, doc_id):
        if collection in self._cache:
            self._cache[collection].pop(str(doc_id), None)

    def collection(self, name):
        return RESTCollection(self, name)

try:
    firebase_admin.get_app()
except ValueError:
    sa_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    if sa_path and os.path.exists(sa_path):
        cred = credentials.Certificate(sa_path)
        firebase_admin.initialize_app(cred, {'projectId': FIREBASE_PROJECT_ID})
    else:
        try:
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, {'projectId': FIREBASE_PROJECT_ID})
        except Exception:
            firebase_admin.initialize_app(options={'projectId': FIREBASE_PROJECT_ID})

try:
    db = firestore.client()
    print("[FIREBASE] Live Firestore Client connected!")
except Exception as e:
    print(f"[FIREBASE] Connecting to live Firestore REST API for project '{FIREBASE_PROJECT_ID}'...")
    db = ResilientRESTFirestore()

# --- AUTH HELPERS ---

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("user_id"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated_function

def get_current_user():
    """Get current logged-in user dict or None from Firestore."""
    user_id = session.get("user_id")
    if not user_id:
        return None
    try:
        doc = db.collection('users').document(str(user_id)).get()
        if doc.exists:
            user_data = doc.to_dict()
            user_data['id'] = doc.id
            return user_data
    except Exception as e:
        print(f"⚠️ [FIRESTORE] Error getting user: {e}")
    return None

def _save_topic_progress():
    """Persist current session topic progress to Firestore user_topics collection."""
    topic_id = session.get("active_topic_id")
    if not topic_id:
        return
    user_id = session.get("user_id") or session.get("guest_id") or f"guest_{topic_id}"
    try:
        topic_ref = db.collection('user_topics').document(str(topic_id))
        topic_ref.set({
            'user_id': user_id,
            'topic_title': session.get("ai_data", {}).get("syllabus", {}).get("topic_title", "Learning Module"),
            'subject_domain': session.get("ai_data", {}).get("syllabus", {}).get("subject_domain", "General"),
            'syllabus_json': json.dumps(session.get("ai_data", {}).get("syllabus", {})),
            'chapter_progress_json': json.dumps(session.get("chapter_progress", {})),
            'total_xp': session.get("total_xp", 0),
            'chapters_generated_json': json.dumps(session.get("ai_data", {}).get("chapters_generated", {})),
            'last_accessed': time.time()
        }, merge=True)
        print(f"🔥 [FIRESTORE] Saved topic progress for topic {topic_id}")
    except Exception as e:
        print(f"⚠️ [SAVE-PROGRESS] Error saving topic progress to Firestore: {e}")


processing_status = {"message": "Idle", "progress": 0, "complete": False}

def _clear_old_chapters():
    """Purge all old chapter data from Firestore chapters collection."""
    try:
        docs = db.collection('chapters').list_documents()
        cnt = 0
        for doc in docs:
            doc.delete()
            cnt += 1
        print(f"🗑️ [CLEANUP] Cleared {cnt} old chapters from Firestore")
    except Exception as e:
        print(f"⚠️ [CLEANUP] Error clearing Firestore chapters: {str(e)}")

# --- FAVICON ROUTE ---
@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'), 'favicon.svg', mimetype='image/svg+xml')

# --- FIREBASE AUTH API HELPERS ---

def create_firebase_auth_user(email, password, display_name=None):
    """Registers user in Firebase Authentication panel so they appear in Firebase Console."""
    try:
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={FIREBASE_API_KEY}"
        payload = {
            "email": email,
            "password": password,
            "returnSecureToken": True
        }
        if display_name:
            payload["displayName"] = display_name
        r = requests.post(url, json=payload, timeout=5)
        if r.status_code == 200:
            res_data = r.json()
            local_id = res_data.get("localId")
            print(f"🔥 [FIREBASE AUTH] Registered user in Firebase Auth Panel: email={email}, localId={local_id}")
            return local_id
        else:
            print(f"⚠️ [FIREBASE AUTH] SignUp response ({r.status_code}): {r.text}")
    except Exception as e:
        print(f"⚠️ [FIREBASE AUTH] Error creating user: {e}")
    return None

def verify_firebase_auth_user(email, password):
    """Authenticates user with Firebase Auth REST API."""
    try:
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
        payload = {
            "email": email,
            "password": password,
            "returnSecureToken": True
        }
        r = requests.post(url, json=payload, timeout=5)
        if r.status_code == 200:
            res_data = r.json()
            local_id = res_data.get("localId")
            print(f"🔥 [FIREBASE AUTH] Verified login in Firebase Auth Panel: email={email}, localId={local_id}")
            return local_id
    except Exception as e:
        print(f"⚠️ [FIREBASE AUTH] Error verifying login: {e}")
    return None

# --- AUTH ROUTES ---

@app.route("/signup", methods=["GET", "POST"])
def signup():
    if session.get("user_id"):
        return redirect(url_for("dashboard"))
    
    role = request.args.get("role", "child")
    if role not in ("child", "parent"):
        role = "child"
    
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        confirm = request.form.get("confirm_password", "")
        display_name = request.form.get("display_name", "").strip() or username
        role = request.form.get("user_type", role)
        age_range = request.form.get("age_range", "11-13")

        errors = []
        if not username or len(username) < 3:
            errors.append("Username must be at least 3 characters.")
        if not email or "@" not in email:
            errors.append("Please enter a valid email address.")
        if not password or len(password) < 6:
            errors.append("Password must be at least 6 characters.")
        if password != confirm:
            errors.append("Passwords do not match.")

        if errors:
            return render_template("signup.html", errors=errors, username=username, email=email, display_name=display_name, role=role)

        # Check existing users in Firestore
        username_query = db.collection('users').where('username', '==', username).limit(1).get()
        if len(username_query) > 0:
            errors.append("Username already taken.")
        email_query = db.collection('users').where('email', '==', email).limit(1).get()
        if len(email_query) > 0:
            errors.append("Email already registered.")
            
        if errors:
            return render_template("signup.html", errors=errors, username=username, email=email, display_name=display_name, role=role)

        # 1. Create in Firebase Authentication Panel
        fb_local_id = create_firebase_auth_user(email, password, display_name=display_name)

        # 2. Store in Firestore Database
        pw_hash = generate_password_hash(password)
        user_ref = db.collection('users').document(fb_local_id) if fb_local_id else db.collection('users').document()
        user_data = {
            'username': username,
            'email': email,
            'password_hash': pw_hash,
            'display_name': display_name,
            'user_type': role,
            'age_range': age_range,
            'firebase_uid': fb_local_id or user_ref.id,
            'created_at': time.time()
        }
        user_ref.set(user_data)
        user_id = user_ref.id

        session["user_id"] = user_id
        session["username"] = username
        session["display_name"] = display_name
        session["user_type"] = role
        session["age_range"] = age_range
        session["student_name"] = display_name
        
        # Transfer active topic to new user
        if session.get("active_topic_id"):
            try:
                db.collection('user_topics').document(str(session["active_topic_id"])).update({'user_id': user_id})
                print(f"🔥 [FIRESTORE AUTH] Transferred topic {session['active_topic_id']} to new user {user_id}")
            except Exception as e:
                print(f"⚠️ [AUTH] Topic transfer error: {e}")

        print(f"🔥 [FIRESTORE AUTH] New user registered: {username} (id={user_id})")
        return redirect(url_for("dashboard"))

    return render_template("signup.html", errors=[], username="", email="", display_name="", role=role)

@app.route("/login", methods=["GET", "POST"])
def login():
    if session.get("user_id"):
        return redirect(url_for("dashboard"))
    if request.method == "POST":
        login_id = request.form.get("login_id", "").strip()
        password = request.form.get("password", "")

        # Query by username or email in Firestore
        users_ref = db.collection('users')
        user_doc = None
        
        by_username = users_ref.where('username', '==', login_id).limit(1).get()
        if len(by_username) > 0:
            user_doc = by_username[0]
        else:
            by_email = users_ref.where('email', '==', login_id.lower()).limit(1).get()
            if len(by_email) > 0:
                user_doc = by_email[0]

        if not user_doc:
            # Try Firebase Auth direct login if email was used
            if "@" in login_id:
                fb_uid = verify_firebase_auth_user(login_id.lower(), password)
                if fb_uid:
                    user_doc = db.collection('users').document(fb_uid).get()

        if not user_doc or not user_doc.exists:
            return render_template("login.html", error="Invalid username/email or password.", login_id=login_id)

        user_data = user_doc.to_dict()
        if not check_password_hash(user_data.get("password_hash", ""), password):
            # Verify via Firebase Auth API as secondary check
            if user_data.get("email"):
                fb_uid = verify_firebase_auth_user(user_data.get("email"), password)
                if not fb_uid:
                    return render_template("login.html", error="Invalid username/email or password.", login_id=login_id)

        user_id = user_doc.id
        session["user_id"] = user_id
        session["username"] = user_data.get("username")
        session["display_name"] = user_data.get("display_name")
        session["user_type"] = user_data.get("user_type", "child")
        session["age_range"] = user_data.get("age_range", "11-13")
        session["student_name"] = user_data.get("student_name") or user_data.get("display_name")
        
        # Restore learning profile if available
        if user_data.get("learning_profile_json"):
            try:
                session["learning_profile"] = json.loads(user_data.get("learning_profile_json"))
                if session["learning_profile"].get("student_name"):
                    session["student_name"] = session["learning_profile"]["student_name"]
            except Exception as e:
                print(f"⚠️ [LOGIN] Error parsing learning_profile_json: {e}")
        
        # Transfer active topic to logged in user
        if session.get("active_topic_id"):
            try:
                db.collection('user_topics').document(str(session["active_topic_id"])).update({'user_id': user_id})
                print(f"🔥 [FIRESTORE AUTH] Transferred topic {session['active_topic_id']} to user {user_id}")
            except Exception as e:
                print(f"⚠️ [AUTH] Topic transfer error: {e}")

        print(f"🔥 [FIRESTORE AUTH] User logged in: {user_data.get('username')} (id={user_id})")
        return redirect(url_for("dashboard"))

    return render_template("login.html", error=None, login_id="")

@app.route("/logout")
def logout():
    _save_topic_progress()
    session.clear()
    return redirect(url_for("index"))

# --- DASHBOARD ---

@app.route("/dashboard")
@login_required
def dashboard():
    user_id = session["user_id"]
    user_doc = db.collection('users').document(str(user_id)).get()
    user_data = user_doc.to_dict() if user_doc.exists else {}

    if not user_data.get("display_name"):
        user_data["display_name"] = session.get("display_name") or session.get("student_name") or session.get("username") or "Learner"
    if not user_data.get("username"):
        user_data["username"] = session.get("username") or "learner"

    created = user_data.get("created_at")
    if hasattr(created, "strftime"):
        user_data["created_at"] = created.strftime("%Y-%m-%d")
    elif isinstance(created, str):
        user_data["created_at"] = created[:10]
    else:
        user_data["created_at"] = "today"

    user_ids_to_query = [user_id]
    if session.get("guest_id"):
        user_ids_to_query.append(session.get("guest_id"))
        
    topics_docs = []
    seen_ids = set()
    for uid in user_ids_to_query:
        found = db.collection('user_topics').where('user_id', '==', uid).get()
        for f in found:
            if f.id not in seen_ids:
                seen_ids.add(f.id)
                topics_docs.append(f)
        
    if not topics_docs and session.get("active_topic_id"):
        active_doc = db.collection('user_topics').document(str(session["active_topic_id"])).get()
        if active_doc.exists and active_doc.id not in seen_ids:
            topics_docs.append(active_doc)

    topic_list = []
    total_xp_all = 0
    for doc in topics_docs:
        t = doc.to_dict()
        t_id = doc.id
        syllabus = json.loads(t.get("syllabus_json") or "{}")
        progress = json.loads(t.get("chapter_progress_json") or "{}")
        total_chapters = len(syllabus.get("chapters", []))
        completed_chapters = sum(1 for v in progress.values() if v.get("completed"))
        t_xp = t.get("total_xp", 0) or 0
        total_xp_all += t_xp
        
        last_acc = t.get("last_accessed")
        last_acc_str = last_acc.strftime('%Y-%m-%d') if hasattr(last_acc, 'strftime') else 'Recently'

        topic_list.append({
            "id": t_id,
            "topic_title": t.get("topic_title") or "Untitled Topic",
            "subject_domain": t.get("subject_domain") or "General",
            "total_chapters": total_chapters,
            "completed_chapters": completed_chapters,
            "total_xp": t_xp,
            "last_accessed": last_acc_str,
            "created_at": "Recently",
            "progress_pct": int((completed_chapters / total_chapters * 100) if total_chapters > 0 else 0)
        })

    return render_template("dashboard.html",
                           user=user_data,
                           topics=topic_list,
                           total_xp_all=total_xp_all)

@app.route("/api/continue-topic/<topic_id>", methods=["POST"])
@login_required
def continue_topic(topic_id):
    try:
        user_id = session["user_id"]
        doc = db.collection('user_topics').document(str(topic_id)).get()
        if not doc.exists:
            return jsonify({"error": "Topic not found"}), 404

        topic = doc.to_dict()
        allowed_ids = [user_id]
        if session.get("guest_id"):
            allowed_ids.append(session.get("guest_id"))
            
        if topic.get("user_id") not in allowed_ids:
            return jsonify({"error": "Unauthorized"}), 403

        _clear_old_chapters()

        syllabus = json.loads(topic.get("syllabus_json") or "{}")
        session["raw_content"] = topic.get("raw_content") or ""
        session["ai_data"] = {
            "syllabus": syllabus,
            "chapters_generated": json.loads(topic.get("chapters_generated_json") or "{}")
        }
        session["chapter_progress"] = json.loads(topic.get("chapter_progress_json") or "{}")
        session["total_xp"] = topic.get("total_xp", 0) or 0
        session["learning_profile"] = json.loads(topic.get("learning_profile_json") or "{}")
        session["cognitive_style"] = topic.get("cognitive_style") or "focus"
        session["gender"] = topic.get("gender") or "female"
        session["emotion"] = topic.get("emotion") or "okay"
        session["student_name"] = session.get("display_name", "Learner")
        session["active_topic_id"] = str(doc.id)
        session["user_type"] = "child"
        session.modified = True

        db.collection('user_topics').document(str(topic_id)).update({
            'last_accessed': firestore.SERVER_TIMESTAMP
        })

        print(f"🔥 [CONTINUE-TOPIC] Restored topic {topic_id} from Firestore")
        return jsonify({"redirect": url_for("chapters")})
    except Exception as e:
        import traceback
        with open("continue_error_log.txt", "w", encoding="utf-8") as f:
            f.write(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@app.route("/api/delete-topic/<topic_id>", methods=["POST"])
@login_required
def delete_topic(topic_id):
    user_id = session["user_id"]
    doc_ref = db.collection('user_topics').document(str(topic_id))
    doc = doc_ref.get()
    allowed_ids = [user_id]
    if session.get("guest_id"):
        allowed_ids.append(session.get("guest_id"))
        
    if doc.exists and doc.to_dict().get("user_id") in allowed_ids:
        doc_ref.delete()
    return jsonify({"status": "deleted"})

# --- MAIN ROUTES ---

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/upload", methods=["POST"])
def upload():
    user_type = request.form.get("user_type")
    content_type = request.form.get("content_type") # 'file' or 'text'
    
    raw_text = ""
    if content_type == "file":
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400
        file = request.files["file"]
        raw_text = extract_text_from_pdf(file)
    else:
        raw_text = request.form.get("text_input", "").strip()

    if not raw_text:
        return jsonify({"error": "No content provided"}), 400

    session["user_type"] = user_type
    session["raw_content"] = raw_text
    session["word_count"] = len(raw_text.split())
    session["ai_data"] = {"syllabus": None}  # Initialize ai_data dictionary
    session["chapter_progress"] = {}  # Initialize chapter progress tracking
    
    if user_type == "parent":
        return jsonify({"redirect": url_for("parent_form")})
    else:
        # Default profile for child
        session["learning_profile"] = {
            "student_name": "Learner",
            "age_range": session.get("age_range", "11-13"),
            "has_adhd": False, "has_dyslexia": False, "has_autism": False,
            "has_anxiety": False, "slow_processing": False, 
            "working_memory": False, "sensory_sensitive": False,
            "confidence_level": "medium"
        }
        return jsonify({"redirect": url_for("onboarding")})

@app.route("/parent-form", methods=["GET", "POST"])
def parent_form():
    if request.method == "POST":
        data = request.form
        needs = data.getlist("needs")
        
        # Determine ADHD profile
        focus_type = data.get("focus_type", "typical")
        has_adhd = focus_type in ["adhd_mild", "adhd_severe", "adhd_hyperfocus"] or data.get("adhd_diagnosis") == "yes"
        adhd_subtype = focus_type
        
        # Parse special interests
        special_interests = data.getlist("special_interests")
        other_interest = data.get("special_interest_other", "").strip()
        if other_interest:
            special_interests.append(other_interest)
        
        # Parse processing speed to numeric multiplier
        proc_speed_map = {"typical": 1.0, "slight": 1.25, "noticeable": 1.5, "very_slow": 2.0}
        processing_speed_raw = data.get("processing_speed", "typical")
        quiz_time_multiplier = proc_speed_map.get(processing_speed_raw, 1.0)
        
        # TTS rate from processing speed
        tts_rate_map = {"typical": "+0%", "slight": "-10%", "noticeable": "-20%", "very_slow": "-30%"}
        
        # Parse confidence level from slider
        confidence_raw = int(data.get("confidence_level", "3"))
        confidence_level = "low" if confidence_raw <= 2 else ("high" if confidence_raw >= 4 else "medium")
        
        session["learning_profile"] = {
            # Identity
            "student_name": data.get("student_name", "Learner"),
            "age_range": data.get("age_range", "11-13"),
            "gender": data.get("gender", "no_preference"),
            "home_language": data.get("home_language", "en"),
            
            # ADHD
            "has_adhd": has_adhd,
            "adhd_subtype": adhd_subtype,
            "session_length_pref": int(data.get("session_length", "10")),
            "special_interests": special_interests,
            
            # Reading/Dyslexia
            "has_dyslexia": any(x in needs for x in ["dyslexia_decoding", "dyslexia_tracking", "dyslexia_spelling"]),
            "dyslexia_decoding": "dyslexia_decoding" in needs,
            "dyslexia_tracking": "dyslexia_tracking" in needs,
            "irlen_syndrome": "irlen_syndrome" in needs,
            
            # Writing/Dysgraphia
            "has_dysgraphia": any(x in needs for x in ["dysgraphia_motor", "dysgraphia_organisation", "dysgraphia_preference"]),
            "dysgraphia_motor": "dysgraphia_motor" in needs,
            "dysgraphia_organisation": "dysgraphia_organisation" in needs,
            "voice_first_input": "dysgraphia_preference" in needs or data.get("input_mode") == "voice",
            
            # Math/Dyscalculia
            "has_dyscalculia": any(x in needs for x in ["dyscalculia_quantity", "dyscalculia_sequence"]),
            "dyscalculia_visual_numbers": "dyscalculia_quantity" in needs,
            
            # Processing
            "slow_processing": processing_speed_raw in ["noticeable", "very_slow"],
            "processing_speed_raw": processing_speed_raw,
            "quiz_time_multiplier": quiz_time_multiplier,
            "default_tts_rate": tts_rate_map.get(processing_speed_raw, "+0%"),
            
            # Memory
            "working_memory": data.get("working_memory", "typical") != "typical",
            "working_memory_severity": data.get("working_memory", "typical"),
            
            # Autism
            "has_autism": any(x in needs for x in ["autism_literal", "autism_routine", "autism_predictability", "autism_sensory"]),
            "autism_literal": "autism_literal" in needs,
            "autism_routine": "autism_routine" in needs,
            "autism_predictability": "autism_predictability" in needs,
            "autism_special_interest": "autism_special_interest" in needs,
            
            # Anxiety
            "has_anxiety": any(x in needs for x in ["anxiety_tests", "anxiety_overwhelm", "anxiety_reassurance", "anxiety_avoidance"]),
            "anxiety_tests": "anxiety_tests" in needs,
            "anxiety_overwhelm": "anxiety_overwhelm" in needs,
            "anxiety_reassurance": "anxiety_reassurance" in needs,
            "hide_leaderboard": "anxiety_tests" in needs or "anxiety_avoidance" in needs,
            
            # Sensory
            "sensory_sensitive": any(x in needs for x in ["sensory_visual", "sensory_auditory", "sensory_clutter", "autism_sensory"]),
            "sensory_visual": "sensory_visual" in needs,
            "sensory_auditory": "sensory_auditory" in needs,
            "sensory_clutter": "sensory_clutter" in needs,
            
            # Confidence & notes
            "confidence_level": confidence_level,
            "confidence_raw": confidence_raw,
            "parent_notes": data.get("parent_notes", "")[:200],
        }
        
        session["student_name"] = session["learning_profile"]["student_name"]
        
        # Persist profile to Firestore user document if logged in
        user_id = session.get("user_id")
        if user_id:
            try:
                db.collection('users').document(str(user_id)).update({
                    'learning_profile_json': json.dumps(session["learning_profile"]),
                    'student_name': session["student_name"]
                })
                print(f"🔥 [FIRESTORE] Saved parent learning_profile for user {user_id}")
            except Exception as e:
                print(f"⚠️ [PARENT-FORM] Error saving profile to user doc: {e}")

        # Persist profile to Firestore topic document if active topic exists
        topic_id = session.get("active_topic_id")
        if topic_id:
            try:
                db.collection('user_topics').document(str(topic_id)).update({
                    'learning_profile_json': json.dumps(session["learning_profile"])
                })
                print(f"🔥 [FIRESTORE] Saved parent learning_profile for topic {topic_id}")
            except Exception as e:
                print(f"⚠️ [PARENT-FORM] Error saving profile to topic doc: {e}")

        return redirect(url_for("onboarding"))
    
    return render_template("parent_form.html")

@app.route("/onboarding", methods=["GET", "POST"])
def onboarding():
    if request.method == "POST":
        data = request.json
        session["student_name"] = data.get("name", session.get("student_name", "Learner"))
        session["cognitive_style"] = data.get("style", "focus")
        session["gender"] = data.get("voice", "standard_female")
        session["emotion"] = data.get("emotion", "okay")
        session["preferred_language"] = data.get("preferred_language", "en")
        
        # Trigger Pipeline Reset — clear stale DB data
        _clear_old_chapters()
        session["ai_data"] = {"chapters": {}, "syllabus": None}
        session["chapter_progress"] = {}
        session["total_xp"] = 0
        
        return jsonify({"redirect": url_for("loading_page")})
    
    return render_template("onboarding.html", 
                           name=session.get("student_name", ""),
                           user_type=session.get("user_type"))

@app.route("/loading")
def loading_page():
    return render_template("loading.html")

@app.route("/api/init-pipeline", methods=["POST"])
def init_pipeline():
    """
    Synchronous endpoint to initialize pipeline.
    Generates syllabus and saves to session.
    Called from loading page via fetch, not as streaming.
    """
    try:
        raw_text = session.get("raw_content", "")
        
        print(f"DEBUG: init_pipeline called")
        print(f"DEBUG: raw_content exists: {bool(raw_text)}")
        
        if not raw_text:
            return jsonify({
                "success": False,
                "error": "No content detected. Please go back and upload a document."
            }), 400
        
        # Clear old chapters before generating new syllabus
        _clear_old_chapters()
        
        # Generate syllabus
        print("DEBUG: Generating syllabus...")
        preferred_language = session.get("preferred_language", "en")
        syllabus = generate_syllabus(raw_text, preferred_language=preferred_language)
        print(f"DEBUG: Syllabus generated with {len(syllabus.get('chapters', []))} chapters")
        
        # Initialize ai_data if needed
        if "ai_data" not in session:
            session["ai_data"] = {}
        if "chapter_progress" not in session:
            session["chapter_progress"] = {}
        
        # Save syllabus to session
        session["ai_data"]["syllabus"] = syllabus
        session["ai_data"]["chapters_generated"] = {}
        
        # Initialize chapter_progress
        chapters = syllabus.get("chapters", [])
        for chapter in chapters:
            c_id = str(chapter["id"])
            if c_id not in session["chapter_progress"]:
                session["chapter_progress"][c_id] = {
                    "completed": False,
                    "game_score": 0,
                    "quiz_score": 0,
                    "xp_earned": 0
                }
        
        session.modified = True
        print(f"DEBUG: Session saved with syllabus")
        
        # Persist topic document to Firestore for both logged-in and guest users
        topic_title = syllabus.get("topic_title", "Learning Module")
        subject_domain = syllabus.get("subject_domain", "General")
        
        user_id = session.get("user_id")
        if not user_id:
            import uuid
            if "guest_id" not in session:
                session["guest_id"] = "guest_" + str(uuid.uuid4())[:8]
            user_id = session["guest_id"]

        topic_ref = db.collection('user_topics').document()
        topic_data = {
            'user_id': user_id,
            'topic_title': topic_title,
            'subject_domain': subject_domain,
            'syllabus_json': json.dumps(syllabus),
            'raw_content': session.get("raw_content", ""),
            'learning_profile_json': json.dumps(session.get("learning_profile", {})),
            'cognitive_style': session.get("cognitive_style", "focus"),
            'gender': session.get("gender", "female"),
            'emotion': session.get("emotion", "okay"),
            'chapter_progress_json': json.dumps(session.get("chapter_progress", {})),
            'chapters_generated_json': json.dumps({}),
            'total_xp': 0,
            'created_at': time.time(),
            'last_accessed': time.time()
        }
        topic_ref.set(topic_data)
        session["active_topic_id"] = str(topic_ref.id)
        session.modified = True
        print(f"🔥 [FIRESTORE] Created user_topic id={topic_ref.id} for user {user_id}")
        
        return jsonify({
            "success": True,
            "chapters_count": len(chapters),
            "message": f"Syllabus ready with {len(chapters)} chapters"
        })
    
    except Exception as e:
        print(f"ERROR in init_pipeline: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route("/api/pipeline-status")
def pipeline_status():
    raw_text = session.get("raw_content", "")
    learning_profile = session.get("learning_profile", {})
    
    @stream_with_context
    def generate():
        if not raw_text:
            error_msg = "No content detected. Please go back and upload a document."
            yield f"data: {json.dumps({'error': error_msg, 'complete': True})}\n\n"
            return

        try:
            yield f"data: {json.dumps({'message': 'Building your personalized syllabus...', 'progress': 30, 'complete': False})}\n\n"
            time.sleep(1)
            
            _clear_old_chapters()
            
            preferred_language = session.get("preferred_language", "en")
            syllabus = generate_syllabus(raw_text, preferred_language=preferred_language)
            
            session["ai_data"]["syllabus"] = syllabus
            session["ai_data"]["chapters_generated"] = {}
            
            chapters = syllabus.get("chapters", [])
            for chapter in chapters:
                c_id = str(chapter["id"])
                if c_id not in session["chapter_progress"]:
                    session["chapter_progress"][c_id] = {
                        "completed": False, 
                        "game_score": 0, 
                        "quiz_score": 0, 
                        "xp_earned": 0
                    }
            
            session.modified = True
            
            yield f"data: {json.dumps({'message': f'Syllabus ready! {len(chapters)} chapters available.', 'progress': 80, 'complete': False})}\n\n"
            time.sleep(1)
            
            yield f"data: {json.dumps({'message': 'Launching learning experience...', 'progress': 100, 'complete': True})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'error': f'Syllabus generation failed: {str(e)}', 'complete': True})}\n\n"

    return Response(generate(), mimetype="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
    })

@app.route("/api/generate-chapter/<int:chapter_id>", methods=["POST"])
def generate_chapter(chapter_id):
    try:
        print(f"\n🚀 [GENERATE-CHAPTER] Starting for chapter {chapter_id}")
        
        # Check if chapter is already cached in Firestore
        ch_doc = db.collection('chapters').document(str(chapter_id)).get()
        if ch_doc.exists:
            print(f"✓ [GENERATE-CHAPTER] Chapter {chapter_id} already cached in Firestore")
            return jsonify({"status": "cached", "message": "Chapter already generated"})
        
        syllabus = session.get("ai_data", {}).get("syllabus")
        if not syllabus:
            return jsonify({"error": "Syllabus not found"}), 400
        
        target_chapter = None
        for ch in syllabus.get("chapters", []):
            if int(ch["id"]) == chapter_id:
                target_chapter = ch
                break
        
        if not target_chapter:
            return jsonify({"error": f"Chapter {chapter_id} not found in syllabus"}), 404
        
        cognitive_style = session.get("cognitive_style", "focus")
        gender = session.get("gender", "female")
        emotion = session.get("emotion", "okay")
        learning_profile = session.get("learning_profile", {})
        raw_text = session.get("raw_content", "")
        
        game_types = ["orbit_launcher", "true_false_blitz", "concept_connect", "sequence_sort", "label_match"]
        subject_domain = syllabus.get("subject_domain", "").lower()
        if any(w in subject_domain for w in ["coding", "programming", "computer", "development", "software"]):
            game_types.append("code_drop")
            
        import random
        assigned_game = random.choice(game_types)
        
        preferred_language = session.get("preferred_language", "en")
        full_chapter = process_chapter(target_chapter, cognitive_style, gender, emotion, learning_profile, raw_text, assigned_game, preferred_language=preferred_language)
        
        full_chapter["audio_url"] = "placeholder.mp3"
        full_chapter["chapter_id"] = str(chapter_id)
        full_chapter["title"] = target_chapter.get("title", "Chapter")
        full_chapter["subject_domain"] = syllabus.get("subject_domain", "General")
        full_chapter["topic_title"] = syllabus.get("topic_title", "Learning Module")
        
        # Save to Firestore
        print(f"🔥 [FIRESTORE] Saving chapter {chapter_id}...")
        db.collection('chapters').document(str(chapter_id)).set({
            'topic_id': 'current',
            'data_json': json.dumps(full_chapter)
        })
        print(f"✓ [GENERATE-CHAPTER] Saved to Firestore successfully")
        
        if "ai_data" not in session:
            session["ai_data"] = {}
        if "chapters_generated" not in session["ai_data"]:
            session["ai_data"]["chapters_generated"] = {}
        session["ai_data"]["chapters_generated"][str(chapter_id)] = True
        session.modified = True
        _save_topic_progress()
        
        return jsonify({
            "status": "success",
            "message": f"Chapter {chapter_id} generated successfully",
            "audio_ready": True
        })
    
    except Exception as e:
        print(f"✗ [GENERATE-CHAPTER] Chapter Generation Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/chapters")
def chapters():
    print("DEBUG: /chapters called")
    print(f"DEBUG: session keys: {list(session.keys())}")
    print(f"DEBUG: ai_data present: {bool(session.get('ai_data'))}")
    
    
    if not session.get("ai_data"):
        print("DEBUG: ai_data not in session, redirecting to index")
        return redirect(url_for("index"))
    
    syllabus = session.get("ai_data", {}).get("syllabus")
    if not syllabus:
        print("DEBUG: syllabus not in ai_data, redirecting to index")
        return redirect(url_for("index"))
    
    # Ensure chapter_progress exists
    if "chapter_progress" not in session:
        session["chapter_progress"] = {}
    
    print(f"DEBUG: /chapters rendering with {len(syllabus.get('chapters', []))} chapters")
    
    return render_template("chapters.html", 
                           syllabus=syllabus,
                           progress=session.get("chapter_progress", {}),
                           total_xp=session.get("total_xp", 0))

@app.route("/learn/<int:chapter_id>")
def learn(chapter_id):
    """
    Display learning content for a chapter.
    Chapter should already be generated by /api/generate-chapter.
    """
    doc = db.collection('chapters').document(str(chapter_id)).get()
    if not doc.exists:
        print(f"⚠️ Chapter {chapter_id} not found in Firestore, redirecting to chapters")
        return redirect(url_for("chapters"))
    
    try:
        data = doc.to_dict()
        chapter = json.loads(data.get("data_json", "{}"))
    except Exception as e:
        print(f"⚠️ Failed to parse chapter {chapter_id} JSON: {str(e)}")
        return redirect(url_for("chapters"))
    
    # Ensure chapter has all required fields
    chapter.setdefault("chapter_id", chapter_id)
    chapter.setdefault("subject_domain", "General")
    chapter.setdefault("title", "Chapter")
    chapter.setdefault("narration_script", "No narration provided.")
    chapter.setdefault("topic_title", "Learning Module")
    chapter.setdefault("key_concepts", [])
    
    return render_template("learn.html", 
                           chapter=chapter,
                           style=session.get("cognitive_style", "focus"),
                           user_voice=session.get("gender", "standard_female"),
                           topic_id=session.get("active_topic_id", 0),
                           preferred_language=session.get("preferred_language", "en"))

@app.route("/api/debug-chapter/<int:chapter_id>")
def debug_chapter(chapter_id):
    """Debug endpoint to see what's in the database and what files exist"""
    import os
    
    print(f"\n🔍 [DEBUG] Checking chapter {chapter_id}...")
    
    # Check database
    doc = db.collection('chapters').document(str(chapter_id)).get()
    if not doc.exists:
        return jsonify({"error": "Chapter not in database"}), 404
    
    chapter = json.loads(doc.to_dict().get("data_json", "{}"))
    audio_url = chapter.get("audio_url")
    
    print(f"✓ Found in database")
    print(f"  - audio_url field: {audio_url}")
    print(f"  - narration_script length: {len(chapter.get('narration_script', ''))}")
    
    # Check files
    audio_dir = "static/audio"
    if os.path.exists(audio_dir):
        files = os.listdir(audio_dir)
        print(f"✓ Audio directory exists with {len(files)} files:")
        for f in files[:5]:  # Show first 5
            size = os.path.getsize(os.path.join(audio_dir, f))
            print(f"    - {f} ({size} bytes)")
    else:
        print(f"✗ Audio directory doesn't exist")
    
    # Check if audio file exists
    return jsonify({
        "chapter_id": chapter_id,
        "narration_length": len(chapter.get('narration_script', ''))
    })

@app.route("/api/tts/speak", methods=["POST"])
def tts_speak():
    """Stream TTS audio for arbitrary text — used by Story Mode Read Aloud."""
    try:
        data = request.get_json(force=True)
        text = (data.get("text") or "").strip()
        lang = data.get("lang", session.get("preferred_language", "en"))
        voice_key = data.get("voice", session.get("voice", "standard_female"))

        if not text:
            return jsonify({"error": "No text provided"}), 400

        # Resolve the correct neural voice for the language
        lang_voice = get_voice_for_language(lang, voice_key)
        voice = lang_voice if lang_voice else "en-US-AriaNeural"

        print(f"🔊 [TTS-SPEAK] lang={lang}, voice={voice}, chars={len(text)}")
        audio_stream = generate_chapter_audio_stream(text, voice_id=voice)
        return Response(stream_with_context(audio_stream), mimetype="audio/mpeg", direct_passthrough=True)

    except Exception as e:
        print(f"✗ [TTS-SPEAK] Error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/audio/stream/<int:chapter_id>")
def stream_audio(chapter_id):
    """Generates audio dynamically on the fly without saving"""
    print(f"\n🔊 [STREAM-AUDIO] Request for chapter {chapter_id}")
    
    voice = request.args.get('voice', 'standard_female')
    
    doc = db.collection('chapters').document(str(chapter_id)).get()
    if not doc.exists:
        return jsonify({"error": "Chapter not found"}), 404
        
    try:
        data = doc.to_dict()
        chapter = json.loads(data.get("data_json", "{}"))
        text = chapter.get('narration_script', '')
        if not text:
            return jsonify({"error": "No text"}), 400
            
        rate = chapter.get("tts_rate", "+0%")
        pitch = chapter.get("tts_pitch", "+0Hz")
        
        # Multilingual voice override
        preferred_language = session.get("preferred_language", "en")
        lang_voice = get_voice_for_language(preferred_language, voice)
        if lang_voice:
            voice = lang_voice  # Override with regional voice
            print(f"🌐 [STREAM-AUDIO] Using multilingual voice: {voice} for language: {preferred_language}")
        
        # Stream audio via True Chunked Generator (0 latency!)
        audio_stream = generate_chapter_audio_stream(text, voice_id=voice, rate=rate, pitch=pitch)
        return Response(stream_with_context(audio_stream), mimetype="audio/mpeg", direct_passthrough=True)
        
    except Exception as e:
        print(f"✗ [STREAM-AUDIO] Failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/game/<int:chapter_id>")
def game(chapter_id):
    print(f"\n[GAME] Loading game for chapter {chapter_id}")
    doc = db.collection('chapters').document(str(chapter_id)).get()
    if not doc.exists:
        print(f"[GAME] Chapter {chapter_id} not found")
        return redirect(url_for("chapters"))
    
    try:
        data = doc.to_dict()
        chapter = json.loads(data.get("data_json", "{}"))
    except Exception as e:
        print(f"✗ [GAME] Failed to parse chapter: {str(e)}")
        return redirect(url_for("chapters"))
    
    # Ensure required fields
    if "chapter_id" not in chapter:
        chapter["chapter_id"] = chapter_id
    
    if "game_items" not in chapter or not chapter["game_items"]:
        print(f"[GAME] No game_items for chapter {chapter_id}, using empty array")
        chapter["game_items"] = []
    else:
        print(f"[GAME] Found {len(chapter.get('game_items', []))} game items")
    
    if "game_type" not in chapter:
        chapter["game_type"] = "true_false_blitz"
    if "game_title" not in chapter:
        chapter["game_title"] = "Knowledge Challenge"
    if "game_instruction" not in chapter:
        chapter["game_instruction"] = "Analyze and execute the task below."
    if "xp_reward" not in chapter:
        chapter["xp_reward"] = 250
    
    print(f"   - Game Type: {chapter.get('game_type')}")
    print(f"   - XP Reward: {chapter.get('xp_reward')}")
    print(f"   - Game Items: {len(chapter.get('game_items', []))}")
    
    return render_template("game.html", chapter=chapter)

@app.route("/api/game-data/<int:chapter_id>")
def game_data(chapter_id):
    doc = db.collection('chapters').document(str(chapter_id)).get()
    if not doc.exists: return jsonify({"error": "No data"}), 404
    
    data = doc.to_dict()
    chapter = json.loads(data.get("data_json", "{}"))
    return jsonify({
        "game_type": chapter.get("game_type"),
        "game_title": chapter.get("game_title"),
        "game_instruction": chapter.get("game_instruction"),
        "game_items": chapter.get("game_items", []),
        "xp_reward": chapter.get("xp_reward", 250)
    })

@app.route("/api/game-complete", methods=["POST"])
def game_complete():
    data = request.json
    c_id = str(data.get("chapter_id"))
    score = data.get("score", 0)
    
    # Ensure chapter_progress exists
    if "chapter_progress" not in session:
        session["chapter_progress"] = {}
    if c_id not in session["chapter_progress"]:
        session["chapter_progress"][c_id] = {"completed": False}
    
    session["chapter_progress"][c_id]["game_score"] = score
    session.modified = True
    
    return jsonify({"status": "saved", "chapter_id": c_id, "score": score})

@app.route("/quiz/<int:chapter_id>")
def quiz(chapter_id):
    print(f"\n📝 [QUIZ] Loading quiz for chapter {chapter_id}")
    doc = db.collection('chapters').document(str(chapter_id)).get()
    if not doc.exists:
        print(f"✗ [QUIZ] Chapter {chapter_id} not found")
        return redirect(url_for("chapters"))
    
    try:
        data = doc.to_dict()
        chapter = json.loads(data.get("data_json", "{}"))
    except Exception as e:
        print(f"✗ [QUIZ] Failed to parse chapter: {str(e)}")
        return redirect(url_for("chapters"))
    
    # Ensure required fields
    if "chapter_id" not in chapter:
        chapter["chapter_id"] = chapter_id
    if "quiz_questions" not in chapter or not chapter["quiz_questions"]:
        print(f"⚠️ [QUIZ] No quiz_questions for chapter {chapter_id}, using empty array")
        chapter["quiz_questions"] = []
    else:
        print(f"✓ [QUIZ] Found {len(chapter.get('quiz_questions', []))} quiz questions")
        # Log first question for debugging
        first_q = chapter["quiz_questions"][0]
        print(f"   - First Q: {first_q.get('question', 'N/A')[:50]}")
        print(f"   - Has difficulty: {'difficulty' in first_q}")
    
    if "key_concepts" not in chapter:
        chapter["key_concepts"] = []
    if "improvement_tip" not in chapter:
        chapter["improvement_tip"] = "Keep practicing to master this topic!"
    if "xp_reward" not in chapter:
        chapter["xp_reward"] = 250
    
    return render_template("quiz.html", chapter=chapter)

@app.route("/api/quiz-data/<int:chapter_id>")
def quiz_data(chapter_id):
    print(f"📝 [API-QUIZ-DATA] Request for chapter {chapter_id}")
    doc = db.collection('chapters').document(str(chapter_id)).get()
    if not doc.exists:
        print(f"✗ [API-QUIZ-DATA] Chapter not found")
        return jsonify({"error": "No data"}), 404
    
    try:
        data = doc.to_dict()
        chapter = json.loads(data.get("data_json", "{}"))
    except Exception as e:
        print(f"✗ [API-QUIZ-DATA] Failed to parse chapter: {str(e)}")
        return jsonify({"error": "Parse error"}), 500
    
    questions = chapter.get("quiz_questions", [])
    print(f"✓ [API-QUIZ-DATA] Returning {len(questions)} questions")
    
    # Validate questions have required fields
    for q in questions:
        q.setdefault("difficulty", "medium")
        q.setdefault("concept_tag", "Concept")
    
    return jsonify({"questions": questions})

@app.route("/api/submit-quiz", methods=["POST"])
def submit_quiz():
    data = request.json
    c_id = str(data.get("chapter_id"))
    score = data.get("score", 0)
    xp_earned = data.get("xp_earned", 0)
    
    print(f"\n🎯 [SUBMIT-QUIZ] Chapter {c_id} submitted")
    print(f"   - Quiz score: {score}%")
    print(f"   - XP earned (from quiz): {xp_earned}")
    
    # Ensure chapter_progress exists
    if "chapter_progress" not in session:
        session["chapter_progress"] = {}
    if c_id not in session["chapter_progress"]:
        session["chapter_progress"][c_id] = {}
    
    # Calculate XP reward based on score (bonus system)
    base_xp = 250
    if score >= 90:
        bonus_xp = base_xp + 100  # 350 XP for mastery
        achievement = "Master 🏆"
    elif score >= 70:
        bonus_xp = base_xp + 50   # 300 XP for good performance
        achievement = "Good 👍"
    elif score >= 50:
        bonus_xp = base_xp        # 250 XP for passing
        achievement = "Passed ✓"
    else:
        bonus_xp = max(50, int(base_xp * (score / 100)))  # Scaled down for low scores
        achievement = "Learning 📚"
    
    print(f"   - Final XP reward: {bonus_xp} ({achievement})")
    
    session["chapter_progress"][c_id].update({
        "quiz_score": score,
        "xp_earned": bonus_xp,
        "completed": True
    })
    
    total_before = session.get("total_xp", 0)
    session["total_xp"] = total_before + bonus_xp
    session.modified = True
    
    # Persist progress to database for logged-in users
    _save_topic_progress()
    
    print(f"   ✓ Total XP: {total_before} → {session['total_xp']}")
    print(f"✓ [SUBMIT-QUIZ] Chapter {c_id} marked as completed\n")
    
    return jsonify({
        "status": "success", 
        "redirect": url_for("game", chapter_id=c_id),
        "score": score,
        "xp_earned": bonus_xp,
        "achievement": achievement
    })

@app.route("/results/<int:chapter_id>")
def results(chapter_id):
    doc = db.collection('chapters').document(str(chapter_id)).get()
    if not doc.exists: return redirect(url_for("chapters"))
    
    chapter = json.loads(doc.to_dict().get("data_json", "{}"))
    progress = session.get("chapter_progress", {}).get(str(chapter_id), {})
    
    # Ensure required fields
    if "chapter_id" not in chapter:
        chapter["chapter_id"] = chapter_id
    if "badge_emoji" not in chapter:
        chapter["badge_emoji"] = "🏆"
    if "badge_name" not in chapter:
        chapter["badge_name"] = "Learner"
    if "topic_title" not in chapter:
        # Try to get from syllabus
        syllabus = session.get("ai_data", {}).get("syllabus", {})
        chapter["topic_title"] = syllabus.get("topic_title", "Learning Module")
    
    return render_template("results.html", 
                           chapter=chapter, 
                           progress=progress,
                           student_name=session.get("student_name", "Explorer"),
                           topic_id=session.get("active_topic_id", 0))

@app.route("/api/leaderboard", methods=["GET", "POST"])
def leaderboard():
    if request.method == "POST":
        data = request.json
        db.collection('leaderboard').add({
            'name': data["name"],
            'topic': data["topic"],
            'score': data["score"],
            'xp': data["xp"],
            'badge': data["badge"],
            'created_at': firestore.SERVER_TIMESTAMP
        })
        return jsonify({"status": "success"})
    
    docs = db.collection('leaderboard').order_by('xp', direction=firestore.Query.DESCENDING).limit(10).get()
    return jsonify([d.to_dict() for d in docs])

@app.route("/parent-dashboard")
def parent_dashboard():
    if session.get("user_type") != "parent":
        return redirect(url_for("index"))
    
    # Fetch emotion analytics for this user's topics
    emotion_data = []
    user_id = session.get("user_id")
    if user_id:
        docs = db.collection('emotion_logs').where('user_id', '==', user_id).limit(200).get()
        emotion_data = [d.to_dict() for d in docs]
    
    # Compute emotion summary
    emotion_summary = {"focused": 0, "bored": 0, "distracted": 0, "stressed": 0, "anxious": 0}
    for e in emotion_data:
        state = e.get("emotion_state", "focused")
        if state in emotion_summary:
            emotion_summary[state] += 1
    total_readings = sum(emotion_summary.values()) or 1
    emotion_percentages = {k: round(v / total_readings * 100) for k, v in emotion_summary.items()}
    
    # Disorder level indicators
    disorder_levels = {
        "anxiety_level": min(100, emotion_percentages.get("anxious", 0) + emotion_percentages.get("stressed", 0)),
        "attention_score": max(0, 100 - emotion_percentages.get("distracted", 0) - emotion_percentages.get("bored", 0)),
        "stress_level": emotion_percentages.get("stressed", 0),
        "engagement_score": emotion_percentages.get("focused", 0)
    }
    
    return render_template("parent_dashboard.html", 
                           student_name=session.get("student_name") or session.get("display_name") or "Learner",
                           progress=session.get("chapter_progress") or {},
                           profile=session.get("learning_profile") or {},
                           syllabus=session.get("ai_data", {}).get("syllabus") or {},
                           emotion_data=emotion_data,
                           emotion_summary=emotion_summary,
                           emotion_percentages=emotion_percentages,
                           disorder_levels=disorder_levels)


# --- EMOTION & ADAPTIVE MODE ENDPOINTS ---

@app.route("/api/emotion-log", methods=["POST"])
def emotion_log():
    """Record an emotion reading from the webcam detector."""
    try:
        data = request.json
        user_id = session.get("user_id")
        topic_id = session.get("active_topic_id")
        
        emotion_state = data.get("emotion_state", "unknown")
        confidence = data.get("confidence", 0)
        chapter_id = data.get("chapter_id")
        
        if user_id:
            db.collection('emotion_logs').add({
                'user_id': user_id,
                'topic_id': topic_id,
                'chapter_id': chapter_id,
                'emotion_state': emotion_state,
                'confidence': confidence,
                'timestamp': firestore.SERVER_TIMESTAMP
            })
        
        return jsonify({"status": "logged", "state": emotion_state})
    except Exception as e:
        print(f"⚠️ [EMOTION-LOG] Error: {str(e)}")
        return jsonify({"status": "error"}), 500


@app.route("/api/emotion-analytics/<topic_id>")
@login_required
def emotion_analytics(topic_id):
    """Get emotion analytics for a specific topic (for parent dashboard)."""
    try:
        user_id = session.get("user_id")
        
        docs = db.collection('emotion_logs').where('user_id', '==', user_id).where('topic_id', '==', topic_id).get()
        data = [d.to_dict() for d in docs]
        
        # Compute summary
        summary = {}
        for row in data:
            state = row.get("emotion_state", "unknown")
            summary[state] = summary.get(state, 0) + 1
        
        return jsonify({"readings": data, "summary": summary, "total": len(data)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/generate-story", methods=["POST"])
def api_generate_story():
    """Generate manga-style story panels for Story Mode."""
    try:
        data = request.json
        chapter_id = data.get("chapter_id")
        
        if not chapter_id:
            return jsonify({"error": "No chapter_id provided"}), 400
        
        doc_ref = db.collection('chapters').document(str(chapter_id))
        doc = doc_ref.get()
        if not doc.exists:
            return jsonify({"error": "Chapter not found"}), 404
        
        chapter = json.loads(doc.to_dict().get("data_json", "{}"))
        
        # --- CACHE CHECK ---
        if "story_data" in chapter and chapter["story_data"]:
            print(f"📖 [STORY-API] Returning CACHED manga story for chapter {chapter_id}")
            return jsonify(chapter["story_data"])
            
        narration = chapter.get("narration_script", "")
        title = chapter.get("title", "Chapter")
        key_concepts = chapter.get("key_concepts", [])
        
        print(f"📖 [STORY-API] Generating manga story for chapter {chapter_id}: {title}")
        
        # Generate story text via Groq
        story_data = generate_manga_story(narration, title, key_concepts)
        
        # Generate manga images via Hugging Face
        panels = story_data.get("panels", [])
        panels = generate_manga_images_batch(panels)
        story_data["panels"] = panels
        
        print(f"✓ [STORY-API] Story generated with {len(panels)} panels")
        
        # --- SAVE TO CACHE ---
        chapter["story_data"] = story_data
        doc_ref.update({'data_json': json.dumps(chapter)})
        
        return jsonify(story_data)
        
    except Exception as e:
        print(f"✗ [STORY-API] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/generate-simple", methods=["POST"])
def api_generate_simple():
    """Generate simplified content for Simple Mode."""
    try:
        data = request.json
        chapter_id = data.get("chapter_id")
        
        if not chapter_id:
            return jsonify({"error": "No chapter_id provided"}), 400
        
        doc_ref = db.collection('chapters').document(str(chapter_id))
        doc = doc_ref.get()
        if not doc.exists:
            return jsonify({"error": "Chapter not found"}), 404
        
        chapter = json.loads(doc.to_dict().get("data_json", "{}"))
        
        # --- CACHE CHECK ---
        if "simple_data" in chapter and chapter["simple_data"]:
            print(f"📋 [SIMPLE-API] Returning CACHED simplified content for chapter {chapter_id}")
            return jsonify(chapter["simple_data"])
            
        narration = chapter.get("narration_script", "")
        title = chapter.get("title", "Chapter")
        key_concepts = chapter.get("key_concepts", [])
        
        print(f"📋 [SIMPLE-API] Generating simplified content for chapter {chapter_id}: {title}")
        
        simple_data = generate_simplified_content(narration, title, key_concepts)
        
        print(f"✓ [SIMPLE-API] Simplified content generated with {len(simple_data.get('cards', []))} cards")
        
        # --- SAVE TO CACHE ---
        chapter["simple_data"] = simple_data
        doc_ref.update({'data_json': json.dumps(chapter)})
        
        return jsonify(simple_data)
        
    except Exception as e:
        print(f"✗ [SIMPLE-API] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# === FEATURE 1: SOCRATIC AI TUTOR ===

@app.route("/api/ask-tutor", methods=["POST"])
@login_required
def ask_tutor():
    """Socratic AI Tutor — answers questions strictly from chapter context."""
    try:
        data = request.json
        question = data.get("question", "").strip()
        chapter_id = data.get("chapter_id")
        topic_id = data.get("topic_id")

        if not question:
            return jsonify({"success": False, "error": "No question provided"}), 400

        # Retrieve chapter narration from DB
        narration = ""
        if chapter_id:
            doc = db.collection('chapters').document(str(chapter_id)).get()
            if doc.exists:
                chapter_data = json.loads(doc.to_dict().get("data_json", "{}"))
                narration = chapter_data.get("narration_script", "")

        # Fallback: try session
        if not narration:
            chapters_gen = session.get("ai_data", {}).get("chapters_generated", {})
            ch_data = chapters_gen.get(str(chapter_id), {})
            if isinstance(ch_data, dict):
                narration = ch_data.get("narration_script", "")

        if not narration:
            return jsonify({"success": False, "error": "Chapter content not found"}), 404

        # Build Socratic system prompt
        age_range = session.get("age_range", session.get("learning_profile", {}).get("age_range", "11-13"))
        learning_profile = session.get("learning_profile", {})
        profile_context = f"Student age range: {age_range}."
        if learning_profile.get("has_dyslexia"):
            profile_context += " Student has dyslexia — use simple words."
        if learning_profile.get("has_anxiety"):
            profile_context += " Student has anxiety — be extra reassuring."
        if learning_profile.get("confidence_level") == "low":
            profile_context += " Student has low confidence — be encouraging."

        system_prompt = (
            f"You are Socrates — a calm, encouraging tutor. Answer the student's question using ONLY the following lecture material. "
            f"Do not introduce any knowledge outside this material. If the answer isn't in the material, say 'That's a great question for after this chapter!' "
            f"Keep your answer to 2-4 sentences maximum, age-appropriate for the student. "
            f"{profile_context}\n\nLecture:\n{narration[:3000]}"
        )

        user_prompt = f"Student's question: {question}"

        # Call LLM — use Groq for fast response
        import os
        model = os.getenv("TUTOR_MODEL", "llama-3.3-70b-versatile")
        answer = call_llm(system_prompt, user_prompt, model=model)

        # Clean up the answer (remove any JSON formatting if present)
        answer = answer.strip().strip('"').strip()

        print(f"💬 [TUTOR] Q: {question[:50]}... A: {answer[:80]}...")
        return jsonify({"success": True, "answer": answer})

    except Exception as e:
        print(f"✗ [TUTOR] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


# === FEATURE 3: LIVE COGNITIVE LOAD INTERVENTION ===

@app.route("/api/emotion-intervention", methods=["POST"])
@login_required
def emotion_intervention():
    """Trigger mid-lesson content simplification based on sustained emotional state."""
    try:
        data = request.json
        state = data.get("state", "")
        chapter_id = data.get("chapter_id")
        topic_id = data.get("topic_id")
        user_id = session.get("user_id")

        # Log to emotion_logs regardless
        if user_id and chapter_id:
            db.collection('emotion_logs').add({
                'user_id': user_id,
                'topic_id': topic_id or session.get("active_topic_id"),
                'chapter_id': chapter_id,
                'emotion_state': state,
                'confidence': 0.9,
                'timestamp': firestore.SERVER_TIMESTAMP
            })

        # Only intervene for distress states
        if state not in ['distressed', 'anxious', 'tired']:
            return jsonify({"success": True, "intervention": False})

        # Retrieve chapter data from DB
        doc = db.collection('chapters').document(str(chapter_id)).get()
        if not doc.exists:
            return jsonify({"success": False, "error": "Chapter not found", "intervention": False}), 404

        chapter_data = json.loads(doc.to_dict().get("data_json", "{}"))
        learning_profile = session.get("learning_profile", {})

        # Generate simplified content
        narration = chapter_data.get("narration_script", "")
        title = chapter_data.get("title", "Chapter")
        key_concepts = chapter_data.get("key_concepts", [])

        simplified = generate_simplified_content(narration, title, key_concepts)

        # Build a simplified narration string from the cards
        simplified_narration = ""
        if simplified and simplified.get("cards"):
            parts = []
            for card in simplified["cards"]:
                parts.append(f"{card.get('emoji', '')} {card.get('heading', '')}: {card.get('content', '')}")
            simplified_narration = "\n\n".join(parts)
            if simplified.get("encouragement"):
                simplified_narration += f"\n\n{simplified['encouragement']}"
        else:
            simplified_narration = narration[:1500]

        # Determine comforting message based on state
        messages = {
            'distressed': "I noticed you might be feeling overwhelmed. Let me simplify things for you. 💚",
            'anxious': "Take a deep breath. Let's make this content a bit easier to follow. 🌿",
            'tired': "Feeling tired? Here's a gentler version of this section. Rest when you need to. 😊"
        }
        message = messages.get(state, "Let's take a moment and simplify things. 🌿")

        print(f"🌿 [INTERVENTION] Triggered for state={state}, chapter={chapter_id}")
        return jsonify({
            "success": True,
            "intervention": True,
            "simplified_narration": simplified_narration,
            "message": message
        })

    except Exception as e:
        print(f"✗ [INTERVENTION] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e), "intervention": False}), 500


# === FEATURE 4: PROGRESS DNA CARD ===

@app.route("/api/dna-card/<topic_id>")
def dna_card(topic_id):
    """Generate Progress DNA Card data for a topic. Works for both logged-in and guest users."""
    try:
        user_id = session.get("user_id")
        
        topic_dict = {}
        chapter_progress = {}
        chapters_generated = {}
        
        # Try to load from database for logged-in users
        if user_id:
            doc = db.collection('user_topics').document(str(topic_id)).get()
            if doc.exists:
                topic_dict = doc.to_dict()
                chapters_generated = json.loads(topic_dict.get("chapters_generated_json", "{}"))
        
        # Fall back to session data (for guest users or if not in DB)
        if not topic_dict:
            ai_data = session.get("ai_data", {})
            syllabus = ai_data.get("syllabus", {})
            
            if not syllabus:
                return jsonify({"success": False, "error": "No learning data available"}), 404
            
            topic_dict = {
                "topic_title": syllabus.get("topic_title", "Learning Module"),
                "cognitive_style": session.get("cognitive_style", "focus"),
                "total_xp": session.get("total_xp", 0),
                "syllabus_json": json.dumps(syllabus),
                "chapters_generated_json": json.dumps(ai_data.get("chapters_generated", {}))
            }
            chapter_progress = session.get("chapter_progress", {})
            chapters_generated = ai_data.get("chapters_generated", {})
        else:
            chapter_progress = json.loads(topic_dict.get("chapter_progress_json", "{}"))

        # Completed chapter count
        completed = sum(1 for v in chapter_progress.values() if isinstance(v, dict) and v.get("completed"))
        syllabus = json.loads(topic_dict.get("syllabus_json", "{}"))
        total_chapters = len(syllabus.get("chapters", []))

        # Total XP
        total_xp = topic_dict.get("total_xp", 0) or 0

        # Emotion distribution from emotion_logs (only for logged-in users)
        emotion_distribution = {}
        if user_id:
            emotion_docs = db.collection('emotion_logs').where('user_id', '==', user_id).where('topic_id', '==', topic_id).get()
            for doc in emotion_docs:
                state = doc.get("emotion_state")
                emotion_distribution[state] = emotion_distribution.get(state, 0) + 1

        # Dominant emotion
        dominant_emotion = "focused"
        if emotion_distribution:
            dominant_emotion = max(emotion_distribution, key=emotion_distribution.get)

        # Average quiz score from chapter_progress
        quiz_scores = []
        for cid, prog in chapter_progress.items():
            if isinstance(prog, dict) and "quiz_score" in prog and prog.get("completed"):
                quiz_scores.append(prog["quiz_score"])
        avg_quiz_score = sum(quiz_scores) / len(quiz_scores) if quiz_scores else 0

        # Badge collection from generated chapters
        badge_collection = []
        for ch_id in chapters_generated.keys():
            ch_doc = db.collection('chapters').document(str(ch_id)).get()
            if ch_doc.exists:
                try:
                    ch_data = json.loads(ch_doc.to_dict().get("data_json", "{}"))
                    badge_collection.append({
                        "badge_emoji": ch_data.get("badge_emoji", "🏆"),
                        "badge_name": ch_data.get("badge_name", "Learner")
                    })
                except:
                    pass

        # Learning style
        learning_style = topic_dict.get("cognitive_style", "focus").capitalize()

        student_name = session.get("display_name", session.get("student_name", "Learner"))

        result = {
            "success": True,
            "student_name": student_name,
            "topic_title": topic_dict.get("topic_title", "Learning Module"),
            "total_xp": total_xp,
            "chapters_completed": completed,
            "total_chapters": total_chapters,
            "emotion_distribution": emotion_distribution,
            "avg_quiz_score": round(avg_quiz_score, 1),
            "badge_collection": badge_collection,
            "dominant_emotion": dominant_emotion,
            "learning_style": learning_style
        }

        print(f"🧬 [DNA-CARD] Generated for topic {topic_id}: {result['topic_title']}")
        return jsonify(result)

    except Exception as e:
        print(f"✗ [DNA-CARD] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


# Study Battle feature removed per user request.


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)

