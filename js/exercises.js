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
  Each exercise:
   muscles  -> activation 0..1  (>=0.7 primary/red, 0.4-0.7 secondary/amber)
   pose     -> drives the side-view figure engine in app.js
                support: 'toes' | 'knees'   (ground contact / pivot)
                handLift: px the hands are raised (incline)
                footLift: px the feet are raised (decline)
                leanFwd:  how far shoulders sit ahead of the hands (lean)
   hands    -> top-down hand-placement diagram: 'shoulder'|'wide'|'diamond'|'archer'|'pseudo'
   steps    -> ordered "how to do it" with the exact positions
   cues     -> key points / common mistakes
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
    pose: { support: "knees", handLift: 0, footLift: 0, leanFwd: 8 },
    hands: "shoulder",
    steps: [
      "Kneel on a mat and place your hands flat on the floor, slightly wider than your shoulders, fingers pointing forward.",
      "Walk your hands forward until your shoulders are stacked over them and your body is one straight line from head to knees. Cross your ankles and lift your feet.",
      "Brace your core and squeeze your glutes — no sagging or piking at the hips.",
      "Bend your elbows (about 45° from your body) and lower your chest until it's a fist's height from the floor.",
      "Press through your palms back to straight arms. That's one rep."
    ],
    cues: [
      "Hips in line with shoulders — don't let them drift up.",
      "Pivot from the knees, not the hips.",
      "Lower under control; don't just drop.",
      "Squeeze the chest at the top."
    ],
    muscles: { chest:0.8, "upper-chest":0.4, "front-delt":0.55, triceps:0.6, core:0.4 }
  },
  {
    id: "incline",
    img: "incline",
    name: "Incline Push-up",
    emoji: "📐",
    level: "Beginner",
    focus: "Lower chest · easier load",
    defaultReps: 12,
    desc: "Hands raised on a bench, step or table. Easier than the floor and biases the lower pec.",
    pose: { support: "toes", handLift: 42, footLift: 0, leanFwd: 8 },
    hands: "shoulder",
    steps: [
      "Place your hands slightly wider than shoulders on a stable raised surface — a bench, step or sturdy table.",
      "Walk your feet back until your body is one straight line from head to heels, leaning into the surface on the balls of your feet.",
      "Keep your core tight and your elbows tucked to about 45°.",
      "Lower your chest to the edge of the surface under control (about 2 seconds down).",
      "Press back up to fully straight arms. The higher the surface, the easier — lower it as you get stronger."
    ],
    cues: [
      "Body straight — don't bend at the hips.",
      "Higher hands = easier; progress toward the floor.",
      "Full range: chest to the surface each rep.",
      "Keep the neck neutral, eyes down."
    ],
    muscles: { chest:0.75, "upper-chest":0.3, "front-delt":0.5, triceps:0.65, core:0.45 }
  },
  {
    id: "standard",
    img: "standard",
    name: "Standard Push-up",
    emoji: "💪",
    level: "Intermediate",
    focus: "Full chest builder",
    defaultReps: 12,
    desc: "The classic. Hits the whole pectoral mass with the triceps and front delts assisting.",
    pose: { support: "toes", handLift: 0, footLift: 0, leanFwd: 10 },
    hands: "shoulder",
    steps: [
      "Start in a high plank: hands flat under your shoulders (or a touch wider), fingers pointing forward.",
      "Set a straight line from head to hips to heels. Squeeze your glutes and brace your abs.",
      "Look slightly ahead with a neutral neck; feet together or hip-width.",
      "Lower until your chest is just above the floor, elbows at ~45° to your torso (arms make an arrow shape, not a T).",
      "Drive through your palms to full lockout, keeping the line straight the whole way."
    ],
    cues: [
      "Elbows ~45°, not flared to 90°.",
      "Hips don't sag or pike — one straight line.",
      "Full range: chest to floor, full lockout up.",
      "Wrists stacked under the shoulders."
    ],
    muscles: { chest:1.0, "upper-chest":0.55, "front-delt":0.7, triceps:0.75, core:0.6, serratus:0.5 }
  },
  {
    id: "wide",
    img: "wide",
    name: "Wide Push-up",
    emoji: "↔️",
    level: "Intermediate",
    focus: "Outer chest stretch",
    defaultReps: 12,
    desc: "Hands set wide shifts tension to the outer pectorals and emphasises the chest over the triceps.",
    pose: { support: "toes", handLift: 0, footLift: 0, leanFwd: 12 },
    hands: "wide",
    steps: [
      "Set up in a high plank with your hands about 1.5× shoulder width apart, fingers pointing slightly outward.",
      "Brace your core and set a straight body line; feet hip-width for a stable base.",
      "Lower your chest toward the floor — you'll feel a stretch across the outer chest. Elbows flare a little more than standard.",
      "Stop when your upper arms are roughly parallel to the floor; don't let the shoulders dump forward.",
      "Press back up, imagining you're squeezing your hands toward each other."
    ],
    cues: [
      "Don't go so wide it hurts the shoulders.",
      "Feel the stretch across the outer pecs.",
      "Keep the body line straight.",
      "Control the bottom — biggest stretch point."
    ],
    muscles: { chest:1.0, "upper-chest":0.5, "front-delt":0.75, triceps:0.5, serratus:0.55, core:0.55 }
  },
  {
    id: "diamond",
    img: "diamond",
    name: "Diamond Push-up",
    emoji: "🔻",
    level: "Intermediate",
    focus: "Inner chest + triceps",
    defaultReps: 10,
    desc: "Hands together under the chest. Hammers the triceps and the inner pec line.",
    pose: { support: "toes", handLift: 0, footLift: 0, leanFwd: 10 },
    hands: "diamond",
    steps: [
      "High plank with your hands together under your chest — index fingers and thumbs touching to form a diamond/triangle.",
      "Set a straight body line and brace; get ready to track your elbows close to your sides.",
      "Lower your chest toward your hands, keeping the elbows tucked in (not flaring out).",
      "Touch (or nearly touch) your chest to your hands at the bottom.",
      "Press up to lockout. Expect the triceps and inner chest to do most of the work."
    ],
    cues: [
      "Elbows stay close to the ribs.",
      "Hands directly under the sternum.",
      "Harder than it looks — drop to knees if needed.",
      "Keep hips from sagging."
    ],
    muscles: { triceps:1.0, chest:0.8, "upper-chest":0.45, "front-delt":0.7, core:0.6 }
  },
  {
    id: "decline",
    img: "decline",
    name: "Decline Push-up",
    emoji: "🛫",
    level: "Advanced",
    focus: "Upper chest emphasis",
    defaultReps: 10,
    desc: "Feet raised on a bench or chair. Tilts the load onto the upper (clavicular) chest and front delts.",
    pose: { support: "toes", handLift: 0, footLift: 46, leanFwd: 8 },
    hands: "shoulder",
    steps: [
      "Place your feet on a stable raised surface and your hands on the floor, slightly wider than shoulders.",
      "Form a straight line from head to heels, now angled head-down. Brace hard — the core works overtime here.",
      "Keep your elbows at ~45° and your neck neutral.",
      "Lower until your upper chest nears the floor.",
      "Press back up to lockout. The higher the feet, the more upper-chest and shoulder emphasis."
    ],
    cues: [
      "Don't let the hips pike up.",
      "Stronger core brace than a flat push-up.",
      "Start with a low surface, raise over time.",
      "Head stays neutral, not craned."
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
    pose: { support: "toes", handLift: 0, footLift: 0, leanFwd: 8 },
    hands: "archer",
    steps: [
      "Set up in a wide high plank, hands turned slightly out, body straight.",
      "Shift your weight toward one hand, bending that elbow while the other arm stays straight and slides out to the side.",
      "Lower until the chest of the working (bent) side is just off the floor; the straight arm acts as a kickstand.",
      "Press back up through the working arm to the centre.",
      "Repeat to the other side — count one rep per side."
    ],
    cues: [
      "Most weight over the bent arm.",
      "Straight arm assists only — don't push hard with it.",
      "Keep hips square to the floor.",
      "Reduce the lean if you can't control it."
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
    pose: { support: "toes", handLift: 0, footLift: 0, leanFwd: 16 },
    hands: "pseudo",
    steps: [
      "Start in a high plank but place your hands down by your lower ribs / waist, fingers turned out to the sides.",
      "Lean your shoulders forward so they travel past your hands — your weight shifts onto the front of your hands.",
      "Keep your body straight and your core and glutes very tight; round the upper back slightly (protract).",
      "Lower under control while holding the forward lean.",
      "Press up and push the floor away at the top. Start with a small range and build."
    ],
    cues: [
      "The forward lean is what makes it work.",
      "Hands low — by the waist, not the shoulders.",
      "Wrists will be loaded; warm them up first.",
      "Small range is fine to start."
    ],
    muscles: { "front-delt":1.0, "upper-chest":0.9, chest:0.7, triceps:0.7, core:0.8, serratus:0.7 }
  }
];
