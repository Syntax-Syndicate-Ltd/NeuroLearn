/**
 * NeuroLearn AI — High Performance C++ Arcade Game Engine
 * File: cpp_games/neuro_arcade_engine.cpp
 * 
 * Provides high-speed 60fps C++ arcade game logic, collision detection,
 * particle physics calculations, score/XP combo multipliers, and JSON state serialization.
 */

#include <iostream>
#include <vector>
#include <string>
#include <cmath>
#include <algorithm>
#include <sstream>

namespace NeuroEngine {

    struct GameObject {
        int id;
        std::string text;
        float x;
        float y;
        float vx;
        float vy;
        float radius;
        bool is_target;
        bool is_active;
        std::string category;
    };

    struct Particle {
        float x, y;
        float vx, vy;
        float life;
        float max_life;
        float size;
        std::string color;
    };

    class CppArcadeEngine {
    private:
        int score;
        int streak;
        int hearts;
        int xp_reward;
        std::vector<GameObject> objects;
        std::vector<Particle> particles;

    public:
        CppArcadeEngine() : score(0), streak(0), hearts(5), xp_reward(250) {}

        void init_stage(const std::vector<std::string>& terms, const std::vector<bool>& targets) {
            objects.clear();
            particles.clear();
            score = 0;
            streak = 0;
            hearts = 5;

            for (size_t i = 0; i < terms.size(); ++i) {
                GameObject obj;
                obj.id = static_cast<int>(i);
                obj.text = terms[i];
                obj.x = 100.0f + (i * 120.0f);
                obj.y = 50.0f + (i % 2 * 40.0f);
                obj.vx = (i % 2 == 0) ? 1.5f : -1.5f;
                obj.vy = 1.0f;
                obj.radius = 35.0f;
                obj.is_target = (i < targets.size()) ? targets[i] : true;
                obj.is_active = true;
                objects.push_back(obj);
            }
        }

        bool handle_target_hit(int object_id) {
            for (auto& obj : objects) {
                if (obj.id == object_id && obj.is_active) {
                    obj.is_active = false;
                    spawn_burst_particles(obj.x, obj.y);

                    if (obj.is_target) {
                        streak++;
                        score += 50 * streak;
                        return true;
                    } else {
                        streak = 0;
                        hearts = std::max(0, hearts - 1);
                        return false;
                    }
                }
            }
            return false;
        }

        void spawn_burst_particles(float px, float py) {
            for (int i = 0; i < 20; ++i) {
                float angle = (i / 20.0f) * 2.0f * 3.14159f;
                float speed = 3.0f + static_cast<float>(rand() % 5);
                Particle p;
                p.x = px;
                p.y = py;
                p.vx = std::cos(angle) * speed;
                p.vy = std::sin(angle) * speed;
                p.life = 1.0f;
                p.max_life = 1.0f;
                p.size = 6.0f;
                p.color = (i % 2 == 0) ? "#10B981" : "#6366F1";
                particles.push_back(p);
            }
        }

        void update_physics(float dt) {
            for (auto& obj : objects) {
                if (obj.is_active) {
                    obj.x += obj.vx * dt;
                    obj.y += obj.vy * dt;
                    if (obj.x < 40 || obj.x > 760) obj.vx *= -1.0f;
                    if (obj.y < 40 || obj.y > 440) obj.vy *= -1.0f;
                }
            }

            for (auto& p : particles) {
                p.x += p.vx;
                p.y += p.vy;
                p.life -= 0.05f;
            }

            particles.erase(
                std::remove_if(particles.begin(), particles.end(), [](const Particle& p) { return p.life <= 0; }),
                particles.end()
            );
        }

        std::string export_state_json() const {
            std::stringstream ss;
            ss << "{";
            ss << "\"score\":" << score << ",";
            ss << "\"streak\":" << streak << ",";
            ss << "\"hearts\":" << hearts << ",";
            ss << "\"active_objects\":" << objects.size() << ",";
            ss << "\"particle_count\":" << particles.size();
            ss << "}";
            return ss.str();
        }

        int get_score() const { return score; }
        int get_streak() const { return streak; }
        int get_hearts() const { return hearts; }
    };
}

extern "C" {
    NeuroEngine::CppArcadeEngine* create_cpp_engine() {
        return new NeuroEngine::CppArcadeEngine();
    }

    void destroy_cpp_engine(NeuroEngine::CppArcadeEngine* engine) {
        delete engine;
    }

    bool cpp_handle_hit(NeuroEngine::CppArcadeEngine* engine, int target_id) {
        return engine ? engine->handle_target_hit(target_id) : false;
    }

    const char* cpp_export_state(NeuroEngine::CppArcadeEngine* engine) {
        static std::string state_str;
        if (engine) {
            state_str = engine->export_state_json();
            return state_str.c_str();
        }
        return "{}";
    }
}

int main() {
    std::cout << "🎮 [C++ ARCADE ENGINE] NeuroLearn C++ Game Subsystem Loaded Successfully!" << std::endl;
    NeuroEngine::CppArcadeEngine engine;
    std::vector<std::string> terms = {"Quantum Mechanics", "Wave Duality", "Classical Myth"};
    std::vector<bool> targets = {true, true, false};
    engine.init_stage(terms, targets);
    std::cout << "✓ Initialized stage state: " << engine.export_state_json() << std::endl;
    return 0;
}
