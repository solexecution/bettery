/* Muscle ids used by the body map + their display labels */
window.MUSCLE_LABELS = {
  "upper-chest": "Upper chest",
  "chest":       "Mid / lower chest",
  "front-delt":  "Front delts",
  "triceps":     "Triceps",
  "serratus":    "Serratus",
  "core":        "Core",
  "biceps":      "Biceps",
  "forearm":     "Forearms",
  "traps":       "Traps",
  "oblique":     "Obliques"
};

/*
  Each exercise maps muscle id -> activation 0..1
   >= 0.7  => primary (red)
   0.4-0.7 => secondary (amber)
   < 0.4   => light involvement
*/
window.EXERCISES = [
  {
    id: "knee",
    name: "Knee Push-up",
    emoji: "🧎",
    level: "Beginner",
    focus: "Whole chest · build the base",
    defaultReps: 10,
    desc: "The starting point. Same chest pattern as a full push-up with less load, so you can groove clean form.",
    cues: [
      "Knees down, hips in line with shoulders — don't pike up.",
      "Hands just wider than shoulders, under the chest.",
      "Lower until your chest is a fist off the floor.",
      "Squeeze the chest to push back up."
    ],
    muscles: { chest:0.8, "upper-chest":0.4, "front-delt":0.55, triceps:0.6, core:0.4 }
  },
  {
    id: "incline",
    name: "Incline Push-up",
    emoji: "📐",
    level: "Beginner",
    focus: "Lower chest · easier load",
    defaultReps: 12,
    desc: "Hands raised on a bench, table or wall. Easier than the floor and biases the lower pec.",
    cues: [
      "Hands on a stable raised surface, shoulder-width+.",
      "Body in one straight line from head to heels.",
      "Higher the hands, the easier it gets.",
      "Control the way down — 2 seconds."
    ],
    muscles: { chest:0.75, "upper-chest":0.3, "front-delt":0.5, triceps:0.65, core:0.45 }
  },
  {
    id: "standard",
    name: "Standard Push-up",
    emoji: "💪",
    level: "Intermediate",
    focus: "Full chest builder",
    defaultReps: 12,
    desc: "The classic. Hits the whole pectoral mass with the triceps and front delts assisting.",
    cues: [
      "Hands ~shoulder-width, fingers forward.",
      "Brace the core, glutes tight — flat plank line.",
      "Elbows ~45° to the body, not flared to 90°.",
      "Chest to the floor, full lockout at the top."
    ],
    muscles: { chest:1.0, "upper-chest":0.55, "front-delt":0.7, triceps:0.75, core:0.6, serratus:0.5 }
  },
  {
    id: "wide",
    name: "Wide Push-up",
    emoji: "↔️",
    level: "Intermediate",
    focus: "Outer chest stretch",
    defaultReps: 12,
    desc: "Hands set wide shifts tension to the outer pectorals and emphasises the chest over the triceps.",
    cues: [
      "Hands ~1.5× shoulder width apart.",
      "Feel a stretch across the outer chest at the bottom.",
      "Don't let the head drop — neutral neck.",
      "Drive the hands together (without moving them)."
    ],
    muscles: { chest:1.0, "upper-chest":0.5, "front-delt":0.75, triceps:0.5, serratus:0.55, core:0.55 }
  },
  {
    id: "diamond",
    name: "Diamond Push-up",
    emoji: "🔻",
    level: "Intermediate",
    focus: "Inner chest + triceps",
    defaultReps: 10,
    desc: "Hands together under the chest. Hammers the triceps and the inner pec line.",
    cues: [
      "Index fingers and thumbs touch — make a diamond.",
      "Hands directly under the sternum.",
      "Keep elbows tucked close on the way down.",
      "Expect this one to burn the triceps fast."
    ],
    muscles: { triceps:1.0, chest:0.8, "upper-chest":0.45, "front-delt":0.7, core:0.6 }
  },
  {
    id: "decline",
    name: "Decline Push-up",
    emoji: "🛫",
    level: "Advanced",
    focus: "Upper chest emphasis",
    defaultReps: 10,
    desc: "Feet raised on a bench or chair. Tilts the load onto the upper (clavicular) chest and front delts.",
    cues: [
      "Feet on a stable surface, hands on the floor.",
      "Higher the feet, the harder — and more shoulder.",
      "Keep a straight line — don't let hips sag.",
      "Lower until the upper chest nears the floor."
    ],
    muscles: { "upper-chest":1.0, chest:0.8, "front-delt":0.9, triceps:0.7, core:0.65, serratus:0.6 }
  },
  {
    id: "archer",
    name: "Archer Push-up",
    emoji: "🏹",
    level: "Advanced",
    focus: "Unilateral strength",
    defaultReps: 6,
    desc: "Shift weight to one arm while the other stays straight. A big step toward the one-arm push-up.",
    cues: [
      "Wide hands; one arm bends, the other extends straight.",
      "Lower toward the bending side.",
      "Keep the straight arm as a guide, light pressure.",
      "Alternate sides each rep — count per side."
    ],
    muscles: { chest:1.0, "upper-chest":0.6, "front-delt":0.8, triceps:0.7, core:0.7, serratus:0.6 }
  },
  {
    id: "pseudo",
    name: "Pseudo Planche Push-up",
    emoji: "🤸",
    level: "Advanced",
    focus: "Upper chest + delts",
    defaultReps: 6,
    desc: "Hands by the waist, leaning forward. Brutal on the upper chest, front delts and serratus.",
    cues: [
      "Hands turned out, set near the hips.",
      "Lean shoulders forward past the hands.",
      "Protract — push the floor away at the top.",
      "Stay tight; small range is fine to start."
    ],
    muscles: { "front-delt":1.0, "upper-chest":0.9, chest:0.7, triceps:0.7, core:0.8, serratus:0.7 }
  }
];
