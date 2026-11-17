# Solmar City — Streets of the Sun

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Khanhduy203/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Khanhduy203/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

https://make.fun/bounty/gta6-01

An original open-world crime game built for make.fun's **gta6-01** bounty.
Play it: serve `game/` with any static server (`node serve.ts`) and open
`game/index.html` in desktop Chrome — it plays with no network request.

## The game

Leo Marín came to **Solmar City** — a sun-soaked coastal city of pastel
towers, palm-lined avenues, parks and a beach boardwalk — with a busted car,
a borrowed pistol and a debt to Dona Vera, the fixer who runs the Mar Azul
diner. Five story missions stand between him and freedom, if the Solmar PD
doesn't catch him first.

- **Open world on foot and by car** — a 5×5-block city with traffic,
  pedestrians, a beach, a marina and the Solmar Tower landmark.
- **Cars to steal and drive** — walk up to any traffic or parked car, press
  E, and drive it. Stealing is a crime: the cops notice.
- **Wanted level with police who respond** — 0–5 stars; police cars chase
  you and officers close in on foot. Stay clean and the heat fades; get
  grabbed and you're busted.
- **Missions and a story** — five jobs from Dona Vera: a delivery, a car
  theft, losing the heat, a turf war at the docks, and the timed Big Score.
- **Combat** — a pistol with hitscan shooting, tracers, and rival gang
  members who shoot back.
- **HUD with minimap** — health, money, wanted stars, objective tracker,
  speedometer, and a live top-down map with the waypoint, police and traffic.
- **Start screen and saving** — new game / continue, autosave and save on
  mission complete, stored in localStorage.
- **Sound, all synthesised** — engine hum, police sirens, gunshots, horns
  and mission jingles from WebAudio; no audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Shift | Sprint |
| Space | Jump / handbrake |
| E | Enter / exit car |
| Click | Shoot (on foot) |
| Drag mouse / Q / E | Orbit camera |
| T | Start next mission |
| M | Mute |

## Structure

- `game/index.html` + `game/style.css` — page shell, HUD and menus
- `game/src/config.js` — tuning constants and city layout numbers
- `game/src/city.js` — procedural city: roads, buildings, beach, ocean
- `game/src/vehicles.js` — car models, traffic AI, player driving
- `game/src/pedestrians.js` — sidewalk walkers and gang members
- `game/src/police.js` — wanted level, police cars and officers
- `game/src/player.js` — Leo on foot, car entry, pistol combat
- `game/src/missions.js` — the five story missions
- `game/src/hud.js` — HUD and minimap rendering
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesised WebAudio sounds
- `game/src/save.js` — localStorage save / load
- `game/src/main.js` — renderer, camera, game loop and wiring
- `game/vendor/three.module.min.js` — vendored three.js r160

Everything in the game — the city, the characters, the vehicles, the story,
the art and the sounds — is original. Nothing is taken from Rockstar Games'
Grand Theft Auto series or any other commercial game.
