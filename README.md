# Agent Carrefour : Contrôle du Trafic par Apprentissage Renforcé (RL) 🚦

[![Docker](https://img.shields.io/badge/Docker-Activ%C3%A9-blue?logo=docker&logoColor=white)](https://www.docker.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-blue?logo=react&logoColor=white)](https://reactjs.org/)
[![SUMO](https://img.shields.io/badge/SUMO-1.18.0-orange)](https://sumo.dlr.de/docs/index.html)

**Agent Carrefour** est une plateforme haut de gamme de gestion du trafic et d'apprentissage par renforcement (Reinforcement Learning). Elle combine la puissance de **SUMO (Simulation of Urban MObility)** avec un backend moderne **FastAPI** et un tableau de bord **React** haute performance pour la visualisation en temps réel et l'analyse de trajectoires.

---

## ✨ Fonctionnalités Clés

- **🗺️ Visualisation de Carte Interactive** : Carte basée sur Leaflet avec superposition de véhicules personnalisés et tracés de trajectoires.
- **📈 Analyse en Temps Réel** : Suivi en direct du nombre de véhicules, de la vitesse moyenne, du temps d'attente total et des longueurs de files d'attente.
- **🕹️ Tableau de Bord de Relecture** : Lecture fluide de la simulation avec contrôle image par image, ajustement de la vitesse et historique des activités.
- **🤖 Intégration RL** : Entraînement en arrière-plan d'un réseau de neurones (DQN) pour optimiser les phases des feux de signalisation.
- **🐳 Dockerisation Complète** : Déploiement en une seule commande pour l'ensemble de la pile (Base de données, Backend, Frontend).

---

## 🚀 Guide de Déploiement

### 📂 Prérequis
Assurez-vous d'avoir installé :
- [Docker & Docker Compose](https://www.docker.com/get-started)
- *Optionnel :* SUMO (si exécution locale sans Docker)

### ⚡ Démarrage Rapide
La méthode la plus robuste pour lancer le projet est d'utiliser Docker Compose :

```bash
# 1. Construire et lancer la pile
docker-compose up --build
```

- **Dashbaord Frontend** : [http://localhost:3000](http://localhost:3000)
- **API Backend** : [http://localhost:8000](http://localhost:8000)
- **Documentation API** : [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🏗️ Architecture du Projet

```text
.
├── backend/            # Moteur de simulation Python & API
│   ├── agent/          # Implémentation Deep Q-Network (DQN)
│   ├── environment/    # Environnement SUMO personnalisé (style Gym)
│   ├── sumo/           # Architecture réseau et fichiers de trajet (.net.xml, .sumocfg)
│   ├── models/         # Poids RL pré-entraînés (.pth)
│   └── api.py          # Points de terminaison FastAPI
├── frontend/           # Tableau de bord de visualisation React
│   └── src/            # Carte Leaflet & composants UI
└── docker-compose.yml  # Orchestration multi-conteneurs
```

---

## 🛠️ Configuration & Personnalisation

Le projet utilise des variables d'environnement pour une configuration facile :

| Variable | Description | Par défaut |
| :--- | :--- | :--- |
| `MONGO_URL` | Chaîne de connexion MongoDB | `mongodb://mongodb:27017/` |
| `VITE_API_URL` | Connexion du frontend à l'API | `http://localhost:8000` |
| `SUMO_HOME` | Chemin vers les outils SUMO (Local uniquement) | `/usr/share/sumo` |

---

## 🔧 Dépannage (Problèmes Courants)

### 🚦 Compatibilité de version SUMO
> [!IMPORTANT]
> L'environnement Docker interne utilise SUMO **1.18.0**. Si vous utilisez des fonctionnalités réseau plus récentes (version 1.26+), vous pourriez rencontrer des erreurs "Unknown vehicle class".
> 
> **Solution appliquée :** Nous avons inclus un script `sanitize_sumo.py` qui supprime automatiquement les classes de véhicules non supportées (`drone`, `scooter`, etc.) pour assurer la compatibilité avec les distributions Linux standards.

### 💾 Aucune donnée de simulation trouvée
Si le tableau de bord est vide au premier lancement, remplissez la base de données en déclenchant une simulation :
1. Allez sur [http://localhost:8000/docs](http://localhost:8000/docs).
2. Exécutez le point de terminaison `POST /simulation/start`.
3. Observez les logs dans votre terminal ; les données apparaîtront en temps réel.

