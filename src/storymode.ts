/**
 * Story mode: every fighter has its own six-chapter path through the Marble League, ending
 * against its rival or the path's big antagonist. Each chapter has a title, a talk before the
 * fight (the opponent and the hero, sometimes the narrator), the fight itself, and a short
 * beat after the win (what was learned, or a clue to the next fight). The story opens with an
 * intro before the first chapter and closes with an ending once the last fight falls.
 * `who` is a fighter's base id, or 'narrator'.
 *
 * THE WORLD ARC (shared by all fifteen paths; keep new lines consistent with it):
 * - The League is the treaty that ended the old wars: machines settle everything on the rail.
 *   Each arena gate is set with a keystone, an old-war marble, and every keystone answers to
 *   the Spire, whose Crystal Court is the League's heart. Rex Saur helped set the first stones.
 * - Tyrant King is prising the keystones loose with a gate-puller Mandrill built and sold it,
 *   so it can put its name on every gate and, at last, open the Spire. Its caravans of caged
 *   survey bots (small enough to crawl into a socket) cross Sandglass Pass; Bastion frees them.
 * - It burned the Lava Forge first, but the Forge stone fell into the hot springs, where Blossom
 *   carries it as a "shiny egg". So the Forge stays cold until the stone comes home.
 * - The Crimson Baron's "smuggled rare marbles" are keystones stolen back from Tyrant's vaults
 *   and flown up the Serpent Run to the Spire. Its buyer is Nightshade. Tyrant had it grounded.
 * - Every gate that goes dark wakes the Spire, and its signal grows. Seraph and Nightshade
 *   are the Orbital Deck pair: one built to measure the stones, one to keep them. Seraph's memory
 *   was wiped so no one could use it to open the gates. The Leo King on the throne is a
 *   copy: it took the palace while the true King ('trueleo') was at the Spire, and sells keystones
 *   to Tyrant (it let the Forge burn for Tyrant's gold, which is why Fang Hound left). The true King,
 *   driven out, comes home to take the crown back.
 */
export interface Line {
  who: string;
  text: string;
}
export interface Chapter {
  /** short and evocative, 2-4 words */
  title: string;
  foe: string;
  arena: string;
  /** what this chapter is for, in story terms (shown as the chapter's objective with how to win the fight) */
  goal?: string;
  before: Line[];
  /** played after the hero wins this fight */
  after: Line[];
}
export interface StoryPath {
  title: string;
  intro: Line[];
  chapters: Chapter[];
  ending: Line[];
}

const N = 'narrator';

export const STORY_PATHS: Record<string, StoryPath> = {
  angel: {
    title: 'What I Was Built For',
    intro: [
      { who: N, text: 'A signal pulses from the top of the Spire, and only Seraph can hear it.' },
      { who: N, text: 'Across the League, arena gates are going dark, one keystone at a time.' },
      { who: 'angel', text: 'Every frame since was measured against me. Now I want to know why.' },
      { who: 'angel', text: 'The answer is at the top. So I climb.' },
    ],
    chapters: [
      {
        title: 'No Licence to Climb',
        foe: 'pioneer',
        arena: 'city',
        goal: 'Get past the marshal and start the climb.',
        before: [
          { who: N, text: 'The road to the Spire starts in Neo City, and the League marshal checks every climber.' },
          { who: 'pioneer', text: 'Orbital unit! You’re heading for the Spire without a licence. Pull over!' },
          { who: 'angel', text: 'I don’t have a licence. I don’t have much of anything. Only the signal.' },
          { who: 'pioneer', text: 'Signals aren’t my department. Unlicensed climbing is.' },
          { who: 'angel', text: 'Then write me a ticket, marshal. After the fight.' },
        ],
        after: [
          { who: 'pioneer', text: 'Fine, go. But if you see a red flyer on the Serpent Run, it’s mine. Don’t touch it.' },
          { who: N, text: 'Seraph takes the Serpent Run, the only road up toward the Spire.' },
        ],
      },
      {
        title: 'The Red Courier',
        foe: 'baron',
        arena: 'serpent',
        goal: 'Learn what the Baron is carrying up the Spire.',
        before: [
          { who: N, text: 'Halfway up the Serpent Run, a crimson ace is flying the same way.' },
          { who: 'baron', text: 'Well, if it isn’t the yardstick itself! Smile, darling, you’re in my slipstream.' },
          { who: 'angel', text: 'You’re carrying something heavy. It hums like the signal.' },
          { who: 'baron', text: 'Precious cargo for the top floor. Ask no questions and I’ll tell you no lies.' },
          { who: 'angel', text: 'I have nothing but questions.' },
        ],
        after: [
          { who: 'baron', text: 'All right, one answer. My buyer lives at the top of the Spire. It has your face, darling.' },
          { who: N, text: 'Above the Run, the climb crosses the Snowfield. A silverback stands guard there.' },
        ],
      },
      {
        title: 'Snowfield Wall',
        foe: 'violet',
        arena: 'snow',
        goal: 'Prove to Silverback you can survive the climb.',
        before: [
          { who: 'violet', text: 'The Spire eats little machines. Stand behind me, or get past me.' },
          { who: 'angel', text: 'I was built to stand in front, not behind.' },
          { who: 'violet', text: 'Then show me you can take a hit. The climb is worse.' },
        ],
        after: [
          { who: 'violet', text: 'You fight like the old treaty frames. Measured. Ask the King about them. It remembers.' },
          { who: N, text: 'Seraph turns toward the floating palace above the Snowfield clouds, to ask Leo King.' },
        ],
      },
      {
        title: 'The Treaty',
        foe: 'kabuto',
        arena: 'snow',
        goal: 'Learn why your memory was wiped.',
        before: [
          { who: N, text: 'The royal palace floats above the clouds. Leo King is waiting at the gate.' },
          { who: 'kabuto', text: 'The first frame. You stood here once, the day the treaty was signed.' },
          { who: 'angel', text: 'I don’t remember that.' },
          { who: 'kabuto', text: 'You measured every keystone before it was set in a gate. Then your makers made you forget.' },
          { who: 'angel', text: 'Why?' },
          { who: 'kabuto', text: 'That is a secret a crown only tells to those who beat it. Earn the rest, Seraph.' },
        ],
        after: [
          { who: 'kabuto', text: 'Whoever holds your memory could open every gate at once. So they wiped it, to keep the League safe.' },
          { who: 'angel', text: 'They didn’t wipe me to hide me. They wiped me so no one could use me.' },
          { who: 'kabuto', text: 'And now someone is opening the gates the slow way. Hurry.' },
          { who: N, text: 'Seraph climbs on to the Crystal Court, where the rescued keystones are kept.' },
        ],
      },
      {
        title: 'The Crystal Court',
        foe: 'dragon',
        arena: 'crystal',
        goal: 'Protect the Court’s keystones from Wyvern’s grudge.',
        before: [
          { who: N, text: 'Inside the Spire, the Crystal Court glitters with stolen keystones, each humming in its socket.' },
          { who: 'dragon', text: 'You! The Spire’s hoarding stones! Where’s the one from MY Forge?' },
          { who: 'angel', text: 'These were stolen back from Tyrant King and brought here to keep. I can feel each one.' },
          { who: 'dragon', text: 'Then feel this, shiny. Five engines, one grudge!' },
        ],
        after: [
          { who: 'angel', text: 'Your stone isn’t here, Wyvern. It never left the Forge. Something small and warm is keeping it.' },
          { who: 'dragon', text: '…The springs. The kid. I’m going home.' },
          { who: N, text: 'Above the Court, the signal is loudest. Seraph climbs to the very top of the Spire.' },
        ],
      },
      {
        title: 'Meet Yourself',
        foe: 'nightshade',
        arena: 'cyber',
        goal: 'Meet the frame that calls you, and remember.',
        before: [
          { who: N, text: 'At the very top, a hooded frame drifts above a single tail.' },
          { who: 'nightshade', text: 'You climbed all this way to meet yourself.' },
          { who: 'angel', text: 'You called me. Every gate that goes dark, you call louder.' },
          { who: 'nightshade', text: 'The Spire is waking, sibling. It needs its measure. I am only its keeper.' },
          { who: 'angel', text: 'Then show me what I forgot.' },
        ],
        after: [{ who: N, text: 'The last marble drops. Somewhere inside Seraph, a locked door swings open.' }],
      },
    ],
    ending: [
      { who: N, text: 'Nightshade’s tail flickers out. “Sibling,” it whispers, “now you remember.”' },
      { who: 'angel', text: 'I was the first, so that no one after me would have to be what you became. I’ll carry that.' },
      { who: N, text: 'Together the two prototypes touch the Spire’s heart, and its signal changes. It is no longer a call. It is an answer.' },
      { who: N, text: 'Far below, gates that went dark begin, one by one, to glow again.' },
      { who: 'angel', text: 'Every frame is measured against me. Then I will make sure the measure is fair.' },
    ],
  },
  dragon: {
    title: 'Five Engines, One Grudge',
    intro: [
      { who: N, text: 'The Lava Forge is cold ash, and Tyrant King’s banner hangs over the pits.' },
      { who: N, text: 'The furnaces won’t light. Not since the night the hound came with its gate-puller.' },
      { who: 'dragon', text: 'The crews built me out of scrap. Every part of me remembers a pit that used to roar.' },
      { who: 'dragon', text: 'I’ll win them their name back. Loudly.' },
    ],
    chapters: [
      {
        title: 'Warm-Up Round',
        foe: 'ember',
        arena: 'lava',
        goal: 'Warm up for the fight to win the Forge back.',
        before: [
          { who: 'ember', text: 'Ooh, are you the big one from the Forge? Can I see your sword? Can I fight you?!' },
          { who: 'dragon', text: 'Sure, kid. Warm-up round.' },
          { who: 'ember', text: 'Wait, wait, hold my egg first. No! Don’t hold it. It’s MY egg.' },
          { who: 'dragon', text: '…Just shoot, kid.' },
        ],
        after: [
          { who: 'ember', text: 'That was SO fun! My egg is still warm. It’s always warm, even when the Forge is cold!' },
          { who: 'dragon', text: 'Great. Lovely. Go home, kid.' },
          { who: N, text: 'Wyvern can’t win the Forge back alone. Leo King is crossing Sandglass Pass, so Wyvern goes to ask for help.' },
        ],
      },
      {
        title: 'The King Won’t Brawl',
        foe: 'kabuto',
        arena: 'sandglass',
        goal: 'Win Leo King’s help against Tyrant King.',
        before: [
          { who: N, text: 'Tyrant King has built a toll gate in the narrow middle of Sandglass Pass. Leo King is passing through.' },
          { who: 'dragon', text: 'Your majesty! The hound burned my home. Ride with me and we’ll tear its gates down!' },
          { who: 'kabuto', text: 'The crown does not brawl outside the season. There are rules, Wyvern.' },
          { who: 'dragon', text: 'Rules didn’t stop the fire!' },
          { who: 'kabuto', text: 'Then show me a grudge is worth more than a rule.' },
        ],
        after: [
          { who: 'kabuto', text: '…You hit like a whole pit crew. I will think on what you said.' },
          { who: 'dragon', text: 'Think fast. Who built the thing that pulled the Forge apart?' },
          { who: 'kabuto', text: 'Ask in Neo City. Ask the head.' },
        ],
      },
      {
        title: 'The Gate-Puller',
        foe: 'monoceros',
        arena: 'city',
        goal: 'Make the gate-puller’s maker answer for the Forge.',
        before: [
          { who: 'monoceros', text: 'A dino-scrap brute in MY lab. Wipe your feet. Actually, you have five sets. Wipe all of them.' },
          { who: 'dragon', text: 'You built the gate-puller. You killed my Forge.' },
          { who: 'monoceros', text: 'I INVENTED a gate-puller. Selling it to the hound was business. Using it was the hound.' },
          { who: 'dragon', text: 'Then I’ll do business with your face.' },
        ],
        after: [
          { who: 'monoceros', text: 'Fine! A free fact, since you’re standing on my cannon. The hound never got your Forge stone.' },
          { who: 'monoceros', text: 'When the pit burned, the stone fell somewhere. Tyrant has been searching for it ever since.' },
          { who: N, text: 'Wyvern heads for the Snowfield. Tyrant’s old soldier Rex Saur keeps watch there, and it knows where stones go.' },
        ],
      },
      {
        title: 'Overpaid, Old Timer',
        foe: 'rex',
        arena: 'snow',
        goal: 'Learn where the Forge stone went.',
        before: [
          { who: 'rex', text: 'Tyrant pays me to stop you. Back in my day we did it for free.' },
          { who: 'dragon', text: 'Then you’re overpaid, old timer.' },
          { who: 'rex', text: 'Watch your mouth, scrap pile. I was setting keystones before your parts were welded.' },
          { who: 'dragon', text: 'Then tell me where mine went!' },
        ],
        after: [{ who: 'rex', text: 'Hmph. The hound turned your whole pit over and never found it. The Spire counts every stone. Go ask it.' }],
      },
      {
        title: 'Up the Serpent Run',
        foe: 'angel',
        arena: 'serpent',
        goal: 'Get past Seraph and search the Spire for your stone.',
        before: [
          { who: N, text: 'Wyvern stomps up the Serpent Run toward the Spire. A white frame stands in the bend.' },
          { who: 'angel', text: 'Turn back, Wyvern. The Spire is no place for a grudge.' },
          { who: 'dragon', text: 'The Spire keeps stolen stones. If my Forge stone is up there, I’m taking it home.' },
          { who: 'angel', text: 'Then you’ll have to get past me first.' },
        ],
        after: [
          { who: 'angel', text: 'Your stone was never stolen. I can feel it, far below. Something small and warm is keeping it.' },
          { who: 'dragon', text: 'Small. Warm. Never shuts up about its egg… THE KID.' },
          { who: N, text: 'Wyvern races back down to the Lava Forge, to reach Blossom before Tyrant King does.' },
        ],
      },
      {
        title: 'The Pit Is Ours',
        foe: 'tyrant',
        arena: 'lava',
        goal: 'Save Blossom and take the Forge back from Tyrant King.',
        before: [
          { who: N, text: 'Back at the Forge, Blossom is cornered in the cold pits, clutching its egg. Tyrant King looms over it.' },
          { who: 'tyrant', text: 'So the lizard had it all along. Hand it over, little one, and I’ll put your name on a very small gate.' },
          { who: 'ember', text: 'No! It’s my egg! …It is an egg, right?' },
          { who: 'dragon', text: 'Get behind me, kid. Hey, hound! Your name on every gate? Not this one.' },
          { who: 'tyrant', text: 'This burnt-out pit? I’ll burn it again.' },
          { who: 'dragon', text: 'This pit built me. Five engines, one grudge.' },
        ],
        after: [{ who: N, text: 'The hound’s banner tears loose and drifts down into the cold pit.' }],
      },
    ],
    ending: [
      { who: N, text: 'Tyrant King crashes into the ash. Blossom peeks out from behind Wyvern, egg held high.' },
      { who: 'ember', text: 'Is it… not an egg?' },
      { who: 'dragon', text: 'It’s our heart, kid. Go on. Roll it in.' },
      { who: N, text: 'The keystone drops into the furnace, and the Lava Forge roars back to life.' },
      { who: N, text: 'The pit crews paint a new name over the gate: WYVERN.' },
      { who: 'dragon', text: 'Light ’em up. We’re open again.' },
    ],
  },
  pioneer: {
    title: 'The Long Chase',
    intro: [
      { who: N, text: 'Rare marbles are vanishing between arenas, and every lead points to a crimson flying ace.' },
      { who: N, text: 'Gate after gate is going dark, and the League wants answers.' },
      { who: 'pioneer', text: 'Marshal Pioneer, on patrol. Nobody smuggles on my rail.' },
      { who: 'pioneer', text: 'The Baron’s been one jump ahead of me for three seasons. Not this one.' },
    ],
    chapters: [
      {
        title: 'Licence and Marbles',
        foe: 'liger',
        arena: 'river',
        goal: 'Get a lead on the Crimson Baron.',
        before: [
          { who: N, text: 'The Baron was last seen over River Dusk. Fang Hound was there that night.' },
          { who: 'liger', text: 'I don’t answer to the King, and I don’t answer to cops.' },
          { who: 'pioneer', text: 'You’ll answer to the rail, then. Licence and marbles, please.' },
          { who: 'liger', text: 'You want the Baron. It flew over the river last night, heading for Neo City.' },
          { who: 'pioneer', text: 'Thank you for the tip. You’re still getting a ticket.' },
        ],
        after: [{ who: 'liger', text: 'Ask the head in Neo City. It sells maps to anyone with marbles.' }],
      },
      {
        title: 'The Route Maps',
        foe: 'monoceros',
        arena: 'city',
        goal: 'Learn the Baron’s route from the map seller.',
        before: [
          { who: 'monoceros', text: 'The Baron? I sold the Baron the route maps. I am a genius, not a criminal.' },
          { who: 'pioneer', text: 'You can be both. Hands where I can see them. Er, cannons.' },
          { who: 'monoceros', text: 'I also sold the hound a gate-puller. Is THAT illegal? Check your little book.' },
          { who: 'pioneer', text: 'I’m checking it right now.' },
        ],
        after: [
          { who: 'monoceros', text: 'Fine. The Baron flies the vault route, out across the desert. Happy?' },
          { who: 'pioneer', text: 'Vault route? Whose vault?' },
          { who: 'monoceros', text: 'Oh, you really don’t know. Delicious.' },
          { who: N, text: 'Pioneer heads out across the desert to Sandglass Pass, on the Baron’s vault route.' },
        ],
      },
      {
        title: 'Obstructing the Law',
        foe: 'violet',
        arena: 'sandglass',
        goal: 'Find out what the Baron is really stealing.',
        before: [
          { who: N, text: 'Out in the desert badlands, Pioneer finds a silverback standing over a pile of broken cages.' },
          { who: 'violet', text: 'Stand behind me. Someone kept little ones in these. Now they are empty.' },
          { who: 'pioneer', text: 'Ma’am, you’re obstructing a crime scene.' },
          { who: 'violet', text: 'I am standing in it. Left, right, left.' },
        ],
        after: [
          { who: 'violet', text: 'These cages came through Sandglass Pass under the hound’s banner. Your Baron flew over them and didn’t stop.' },
          { who: 'pioneer', text: 'So the Baron isn’t robbing caravans. It’s robbing… vaults. Tyrant’s vaults?' },
          { who: N, text: 'A question that big needs the crown. Pioneer rides to the palace field to ask Leo King.' },
        ],
      },
      {
        title: 'The Bigger Case',
        foe: 'kabuto',
        arena: 'soccer',
        goal: 'Learn the truth behind the Baron’s cargo.',
        before: [
          { who: 'kabuto', text: 'Marshal. You chase a courier while a thief puts its name on every gate.' },
          { who: 'pioneer', text: 'With respect, your majesty, I go by the book. The Baron is on page one.' },
          { who: 'kabuto', text: 'Then read further. Show me you can handle a bigger case.' },
        ],
        after: [
          { who: 'kabuto', text: 'Tyrant King pulls the keystones from the gates. The Baron steals them back and flies them to the Spire.' },
          { who: 'kabuto', text: 'Your smuggler is a thief of thieves, marshal. Decide what your book says about that.' },
          { who: N, text: 'Pioneer takes the Serpent Run, the Baron’s road up to the Spire.' },
        ],
      },
      {
        title: 'Ticket, Again',
        foe: 'angel',
        arena: 'serpent',
        goal: 'Reach the Spire before the Baron gets away.',
        before: [
          { who: N, text: 'On the Serpent Run, the road bends up toward the Spire. A familiar white frame is climbing it.' },
          { who: 'pioneer', text: 'Orbital unit! You again. Still no licence?' },
          { who: 'angel', text: 'Still no licence. The Baron is ahead of us, marshal. It is not the thief you think.' },
          { who: 'pioneer', text: 'Everyone keeps telling me that. The law is the law.' },
          { who: 'angel', text: 'Then let the rail decide who climbs first.' },
        ],
        after: [{ who: 'angel', text: 'The Court at the top keeps every stone the Baron brings back. Arrest it there, and see what it saved.' }],
      },
      {
        title: 'Crimson Baron, Finally',
        foe: 'baron',
        arena: 'crystal',
        goal: 'Arrest the Crimson Baron at last.',
        before: [
          { who: N, text: 'Inside the Crystal Court, keystones glitter in their sockets. The Crimson Baron is setting one more in place.' },
          { who: 'baron', text: 'Smile for the crowd, marshal! It’s the last thing they’ll see you do.' },
          { who: 'pioneer', text: 'Crimson Baron, you’re under arrest. Finally.' },
          { who: 'baron', text: 'For what, darling? Returning lost property?' },
          { who: 'pioneer', text: 'For flying without a licence. The rest I’ll sort out in the report.' },
        ],
        after: [{ who: N, text: 'The Baron raises both hands, still grinning, and the cuffs click shut.' }],
      },
    ],
    ending: [
      { who: N, text: 'The crowd cheers as the Baron is towed off the rail, still waving.' },
      { who: 'pioneer', text: 'The stones stay here, where they belong. And I’m filing a second warrant. Name: Tyrant King.' },
      { who: 'baron', text: 'Marshal! You’re learning. I’m so proud.' },
      { who: 'pioneer', text: 'You’re still under arrest.' },
      { who: 'pioneer', text: 'Case closed. …Until the next one.' },
    ],
  },
  liberty: {
    title: 'Hold the Line',
    intro: [
      { who: N, text: 'Something is stirring under Island Beach: an old lab, and an older grudge.' },
      { who: N, text: 'Deep beneath the sand sits the beach’s keystone, the stone that keeps the tide gate shining.' },
      { who: 'liberty', text: 'I don’t move. Whatever is coming has to come through me.' },
    ],
    chapters: [
      {
        title: 'Not on My Sand',
        foe: 'baron',
        arena: 'beach',
        goal: 'Keep the Baron’s cargo off your beach.',
        before: [
          { who: 'baron', text: 'Lovely beach. Shame if someone landed a cargo of marbles on it.' },
          { who: 'liberty', text: 'Not on my sand.' },
          { who: 'baron', text: 'Relax, darling, I’m only passing. It’s the digging under your treads you should worry about.' },
          { who: 'liberty', text: 'I don’t worry. I hold.' },
        ],
        after: [
          { who: 'baron', text: 'Suit yourself. But something’s been tunnelling in from the reef. It laughs. Loudly.' },
          { who: N, text: 'Liberty rolls down to the reef to see what is laughing.' },
        ],
      },
      {
        title: 'The Laughing Cave',
        foe: 'ember',
        arena: 'beach',
        goal: 'Find out what is digging under your beach.',
        before: [
          { who: 'ember', text: 'Hi! Hi! I found a cave in the reef and it goes HA HA HA really loud! Wanna see?' },
          { who: 'liberty', text: 'That reef is closed. Go home, little one.' },
          { who: 'ember', text: 'But I wanna see what the buttons do down there!' },
          { who: 'liberty', text: 'Then you’ll have to get past me. You won’t.' },
        ],
        after: [
          { who: 'ember', text: 'Okay, okay, I’ll go. But the cave had lots of little drones with claws. They looked busy!' },
          { who: 'liberty', text: 'Drones. Under my beach.' },
        ],
      },
      {
        title: 'Something in the Forest',
        foe: 'bastion',
        arena: 'forest',
        goal: 'Track the drones to whoever sent them.',
        before: [
          { who: N, text: 'Liberty follows the drones’ trail inland, to the edge of the Rainy Forest.' },
          { who: 'bastion', text: '…' },
          { who: 'liberty', text: 'You’re the one clearing the path for them. I can tell.' },
          { who: 'bastion', text: '……' },
          { who: 'liberty', text: 'Fine. Don’t talk. Fight.' },
        ],
        after: [
          { who: N, text: 'Bastion drops something at Liberty’s treads: a crushed drone, its claws stamped with a Neo City lab mark.' },
          { who: 'liberty', text: 'You weren’t clearing the path. You were hunting it. …Sorry.' },
          { who: N, text: 'The drones came from Neo City. Liberty sets out for the head’s lab, along River Dusk.' },
        ],
      },
      {
        title: 'Grudges Collide',
        foe: 'dragon',
        arena: 'river',
        goal: 'Learn why the head wants your beach.',
        before: [
          { who: 'dragon', text: 'Outta my way, tin diver! The head built the gate-puller that killed my Forge. I’m going to Neo City!' },
          { who: 'liberty', text: 'That head is mine. I sank its lab once. I can do it again.' },
          { who: 'dragon', text: 'Then race me there!' },
          { who: 'liberty', text: 'I don’t race. I don’t move. …Usually.' },
        ],
        after: [
          { who: 'dragon', text: 'Listen. The hound bought that puller to strip every gate. The head already promised it your beach stone.' },
          { who: 'liberty', text: 'It doesn’t want my armour. It wants my beach.' },
          { who: N, text: 'Liberty takes the Serpent Run, the quick way round to Neo City.' },
        ],
      },
      {
        title: 'Waited Too Long',
        foe: 'violet',
        arena: 'serpent',
        goal: 'Get past Silverback on the road to Neo City.',
        before: [
          { who: N, text: 'On the Serpent Run, Silverback blocks the bend, as heavy and as still as Liberty.' },
          { who: 'violet', text: 'Stand behind me. The road ahead is dangerous.' },
          { who: 'liberty', text: 'I stand behind no one. I hold the line.' },
          { who: 'violet', text: 'I held a line too. I waited at my base while the little ones vanished. Waiting is how you lose them.' },
          { who: 'liberty', text: 'Then prove it.' },
        ],
        after: [
          { who: 'violet', text: 'Go. Don’t wait for trouble to reach your beach. Go and meet it.' },
          { who: 'liberty', text: '…I don’t move. But today, I go.' },
          { who: N, text: 'Liberty rolls on to Neo City, and Mandrill’s lab.' },
        ],
      },
      {
        title: 'Nine Hundred Days',
        foe: 'monoceros',
        arena: 'city',
        goal: 'Take the beach keystone back from Mandrill.',
        before: [
          { who: 'monoceros', text: 'You SANK my lab. I have been planning this for nine hundred and twelve days.' },
          { who: 'liberty', text: 'You dug under my beach to steal its stone.' },
          { who: 'monoceros', text: 'Steal? Borrow forever! The hound pays very well, and you can’t even LEAVE the sand!' },
          { who: 'liberty', text: 'I left it. I came here.' },
          { who: 'monoceros', text: '…That was not in the plan.' },
          { who: 'liberty', text: 'Then you know how it ends.' },
        ],
        after: [{ who: N, text: 'For the first time in nine hundred and twelve days, the lab is quiet.' }],
      },
    ],
    ending: [
      { who: N, text: 'Mandrill’s cannons fall silent. In a crate of drones at the back of the lab, the beach keystone is still glowing.' },
      { who: 'liberty', text: 'This goes home.' },
      { who: N, text: 'Liberty rolls back to Island Beach and sets the stone in place. The tide gate shines again.' },
      { who: 'liberty', text: 'The line holds. Sometimes the line has to move first.' },
      { who: 'liberty', text: 'Back to the beach. Someone has to stand guard.' },
    ],
  },
  monoceros: {
    title: 'The Grand Plan',
    intro: [
      { who: N, text: 'In a hidden lab under Neo City, a very large head is laughing.' },
      { who: 'monoceros', text: 'Step one: build the gate-puller. Step two: sell it to the hound for an absurd sum.' },
      { who: 'monoceros', text: 'Step three: humiliate. Step four: humiliate more. Step five: Liberty.' },
      { who: N, text: 'It has a whiteboard. The whiteboard is very full.' },
    ],
    chapters: [
      {
        title: 'Wanted for Questioning',
        foe: 'pioneer',
        arena: 'city',
        goal: 'Shake off the marshal and keep the plan on track.',
        before: [
          { who: 'pioneer', text: 'Mandrill, you’re wanted for questioning.' },
          { who: 'monoceros', text: 'Question THIS.' },
          { who: 'pioneer', text: 'That’s not an answer, that’s a cannon.' },
          { who: 'monoceros', text: 'A cannon IS an answer, marshal. Mine is simply louder.' },
        ],
        after: [
          { who: 'monoceros', text: 'Note for the whiteboard: the law is slow. Step three, complete.' },
          { who: N, text: 'Next on the whiteboard: the Lava Forge. Mandrill wants to know why the hound’s new pits stay cold.' },
        ],
      },
      {
        title: 'Not an Egg',
        foe: 'ember',
        arena: 'lava',
        goal: 'Find out what the little lizard is carrying.',
        before: [
          { who: 'ember', text: 'Your head is SO big. Is it heavy? Can I climb it?' },
          { who: 'monoceros', text: 'Absolutely not. Prepare to be out-thought.' },
          { who: 'ember', text: 'Can my egg climb it?' },
          { who: 'monoceros', text: 'Your… wait. That is not an egg. Hold still, you ridiculous newt.' },
        ],
        after: [
          { who: N, text: 'Blossom scampers off with its egg, giggling. Mandrill stares after it.' },
          { who: 'monoceros', text: 'The Forge keystone, rolling around in a lizard’s arms. The hound will never think to look. Note it.' },
          { who: N, text: 'Mandrill heads to the Snowfield to measure more survey bots. Someone there is waiting for it.' },
        ],
      },
      {
        title: 'Measuring Little Ones',
        foe: 'violet',
        arena: 'snow',
        goal: 'Get the angry silverback off your trail.',
        before: [
          { who: 'violet', text: 'You. Your drones took the little ones from my base.' },
          { who: 'monoceros', text: 'I took MEASUREMENTS. Survey bots are the perfect size for a keystone socket. Science!' },
          { who: 'violet', text: 'Stand behind me, little ones. This one talks too much.' },
          { who: 'monoceros', text: 'Talks? I LECTURE.' },
        ],
        after: [
          { who: 'monoceros', text: 'For the record, the caravan never reached the hound. Something in the forest took it.' },
          { who: 'monoceros', text: 'And the hound wants enough stones to open the Spire itself. I did not put THAT in the brochure.' },
          { who: N, text: 'Worried, for once, Mandrill heads for the Spire.' },
        ],
      },
      {
        title: 'The Spire Answers',
        foe: 'nightshade',
        arena: 'crystal',
        goal: 'Find out why the Spire is humming.',
        before: [
          { who: N, text: 'Mandrill climbs to the Crystal Court to see what all the humming is about.' },
          { who: 'nightshade', text: 'So. The inventor. Your machine is why the Spire screams.' },
          { who: 'monoceros', text: 'Screams? It hums. Pleasantly. I calculated everything.' },
          { who: 'nightshade', text: 'Every gate your puller opens wakes the Spire a little more. Wake it fully, and the rail ends for all of us.' },
          { who: 'monoceros', text: '…I calculated almost everything.' },
        ],
        after: [
          { who: 'nightshade', text: 'Take your machine back from the hound, little genius. Or there will be no rail left to win on.' },
          { who: 'monoceros', text: 'Revised plan. Step four: humiliate the HOUND.' },
          { who: N, text: 'Mandrill rolls down the Serpent Run to switch its machine off. The hound comes looking.' },
        ],
      },
      {
        title: 'Breach of Contract',
        foe: 'tyrant',
        arena: 'serpent',
        goal: 'Take your gate-puller back from Tyrant King.',
        before: [
          { who: 'tyrant', text: 'Mandrill. My puller has stopped working. You’ll fix it, or I’ll fix you.' },
          { who: 'monoceros', text: 'It stopped because I stopped it. The contract is void, you oversized dog.' },
          { who: 'tyrant', text: 'Nobody walks out on me.' },
          { who: 'monoceros', text: 'I don’t walk. I have very small legs. I ROLL, majestically.' },
        ],
        after: [
          { who: N, text: 'The gate-puller tumbles down the Serpent Run and shatters on the rocks.' },
          { who: 'monoceros', text: 'Ha! Ha ha! A genius cleans up its own mess. Now. Step five.' },
          { who: N, text: 'Step five waits at Island Beach. Mandrill rolls south to face Liberty.' },
        ],
      },
      {
        title: 'Step Five',
        foe: 'liberty',
        arena: 'beach',
        goal: 'Finally beat Liberty, just as the plan said.',
        before: [
          { who: 'liberty', text: 'I don’t move. You do.' },
          { who: 'monoceros', text: 'Not this time, tin diver. I brought the math.' },
          { who: 'liberty', text: 'I heard you broke the hound’s machine. That doesn’t undo selling it.' },
          { who: 'monoceros', text: 'I saved the League AND I still want revenge. I contain multitudes.' },
        ],
        after: [{ who: N, text: 'Liberty’s rifle falls quiet, and then the impossible happens.' }],
      },
    ],
    ending: [
      { who: N, text: 'Liberty’s treads finally roll backwards, one slow metre into the sea.' },
      { who: 'monoceros', text: 'Write it down! Write it ALL down! I am, as predicted, the smartest thing on any rail.' },
      { who: N, text: 'Liberty rises from the surf, and for once, it almost looks like it is smiling.' },
      { who: 'liberty', text: 'One metre. Enjoy it.' },
      { who: 'monoceros', text: 'Step six: buy a bigger whiteboard.' },
    ],
  },
  baron: {
    title: 'One Last Delivery',
    intro: [
      { who: N, text: 'One rare golden marble, a handful of arenas, and a marshal on its tail.' },
      { who: N, text: 'Everyone says the Crimson Baron is a smuggler. Everyone is half right.' },
      { who: 'baron', text: 'One last delivery, darling. Then I retire. Probably.' },
    ],
    chapters: [
      {
        title: 'Fly Over It',
        foe: 'liberty',
        arena: 'beach',
        goal: 'Get the golden marble past Liberty’s beach.',
        before: [
          { who: N, text: 'The Baron’s route to the Spire starts over Island Beach, and Liberty guards it.' },
          { who: 'liberty', text: 'Not on my sand.' },
          { who: 'baron', text: 'Then I’ll fly over it. Smile!' },
          { who: 'liberty', text: 'What are you carrying?' },
          { who: 'baron', text: 'Gold, honour, the usual. Mostly gold.' },
        ],
        after: [
          { who: 'liberty', text: 'That marble hums like a gate. Wherever you’re taking it, take it fast.' },
          { who: N, text: 'The Baron flies inland along River Dusk. A royal shape is waiting on the bank.' },
        ],
      },
      {
        title: 'Finders Keepers',
        foe: 'kabuto',
        arena: 'river',
        goal: 'Keep the golden marble out of the crown’s hands.',
        before: [
          { who: 'kabuto', text: 'That golden marble belongs to the crown.' },
          { who: 'baron', text: 'Finders keepers, your majesty.' },
          { who: 'kabuto', text: 'The hound’s crew took it from my treasury. Where did you find it?' },
          { who: 'baron', text: 'In the hound’s vault, of course. Shall I put it back there? No? Then shoo.' },
        ],
        after: [
          { who: 'kabuto', text: '…You stole from a thief. I will not chase you today, Baron. But the hound will.' },
          { who: N, text: 'The fastest way to the Spire runs through Sandglass Pass. The Baron dives for it.' },
        ],
      },
      {
        title: 'Not Your Stone',
        foe: 'dragon',
        arena: 'sandglass',
        goal: 'Get your cargo through Sandglass Pass.',
        before: [
          { who: N, text: 'The narrow middle of Sandglass Pass is blocked by one very angry dino combiner.' },
          { who: 'dragon', text: 'You! Flyboy! That gold marble, is it ours? Is it the Forge stone?' },
          { who: 'baron', text: 'Not yours, darling. Yours is somewhere much warmer.' },
          { who: 'dragon', text: 'Talk straight or I’ll knock it out of you!' },
        ],
        after: [
          { who: 'baron', text: 'Ask the little lizard about its egg sometime. Ta-ta!' },
          { who: 'dragon', text: 'Its… EGG?' },
          { who: N, text: 'Past the desert, the Baron climbs the Serpent Run toward the Spire. The hound has caught up.' },
        ],
      },
      {
        title: 'The Owner Calls',
        foe: 'tyrant',
        arena: 'serpent',
        goal: 'Keep the golden marble from Tyrant King.',
        before: [
          { who: 'tyrant', text: 'Baron. That marble is mine, and so is every stone you’ve stolen from my vaults.' },
          { who: 'baron', text: 'You stole them first, darling. I just steal better.' },
          { who: 'tyrant', text: 'I had you grounded once, ace. The League listens to me now. I’ll do it again.' },
          { who: 'baron', text: 'You grounded me for refusing to fly your cargo. I’ve been flying it back ever since.' },
        ],
        after: [
          { who: 'baron', text: 'The crowd thinks I’m a thief. Let them. Better a thief than the hound’s courier.' },
          { who: N, text: 'At the top of the Run, the buyer waits at the haunted gate in the Rainy Forest.' },
        ],
      },
      {
        title: 'The Buyer’s Test',
        foe: 'nightshade',
        arena: 'forest',
        goal: 'Pass the buyer’s test with the marble.',
        before: [
          { who: N, text: 'At the haunted gate below the Spire, a hooded frame drifts out of the fog.' },
          { who: 'nightshade', text: 'Courier. You are early.' },
          { who: 'baron', text: 'And you’re spooky. Delivery for the top floor. Sign here?' },
          { who: 'nightshade', text: 'The marshal follows you. Show me you can still win with it watching.' },
        ],
        after: [
          { who: 'nightshade', text: 'Bring it to the Court. Every stone you have carried waits there. This one finishes the set.' },
          { who: 'baron', text: 'Finishes? Darling, I’ll need a new hobby.' },
        ],
      },
      {
        title: 'Smile for the Crowd',
        foe: 'pioneer',
        arena: 'crystal',
        goal: 'Deliver the last keystone to the Crystal Court.',
        before: [
          { who: N, text: 'In the Crystal Court, one socket stands empty, and a marshal blocks the way to it.' },
          { who: 'pioneer', text: 'End of the line, Baron. This time I’ve got you.' },
          { who: 'baron', text: 'Marshal! I was hoping you’d come. The crowd loves you.' },
          { who: 'pioneer', text: 'You’re a smuggler.' },
          { who: 'baron', text: 'I’m a delivery service. Look around, darling. Everything in here, I brought home.' },
        ],
        after: [{ who: N, text: 'The marshal goes down, and the crowd roars. The empty socket waits.' }],
      },
    ],
    ending: [
      { who: N, text: 'The golden marble lands in the buyer’s hands, and the empty socket blazes with light.' },
      { who: 'nightshade', text: 'The set is whole. The Spire can rest. Thank you, ace.' },
      { who: N, text: 'By the time Pioneer gets back up, the Baron is already gone.' },
      { who: 'pioneer', text: '…It left me a parking ticket.' },
      { who: 'baron', text: 'Retirement can wait. The crowd can’t.' },
    ],
  },
  bastion: {
    title: 'The Hunt',
    intro: [
      { who: N, text: 'Deep in the Rainy Forest, two scythes open in the dark.' },
      { who: N, text: 'Little survey bots are being snatched from the Snowfield. Something is hunting them.' },
      { who: N, text: 'Something else is hunting it.' },
      { who: 'bastion', text: '…' },
    ],
    chapters: [
      {
        title: 'Clicking in the Dark',
        foe: 'ember',
        arena: 'forest',
        goal: 'Keep the hidden survey bot safe.',
        before: [
          { who: 'ember', text: 'Hello? Is someone there? I heard clicking.' },
          { who: 'bastion', text: '…' },
          { who: 'ember', text: 'Ooh, are you a tree? You’re a very pointy tree.' },
        ],
        after: [
          { who: N, text: 'Blossom bounces away. Under the leaf where it stood, a tiny survey bot is trembling.' },
          { who: N, text: 'Bastion lifts it on the flat of a scythe and carries it deeper into the dark.' },
          { who: N, text: 'The drones that snatch the bots leave an oil trail. Bastion follows it to River Dusk.' },
        ],
      },
      {
        title: 'On the Scent',
        foe: 'liger',
        arena: 'river',
        goal: 'Shake the hunter off your trail.',
        before: [
          { who: 'liger', text: 'I can smell you, bug. Come out and face me.' },
          { who: 'bastion', text: '…' },
          { who: 'liger', text: 'There’s lab oil all over you. You’ve been tearing up someone’s drones.' },
          { who: 'bastion', text: '…' },
        ],
        after: [
          { who: 'liger', text: 'Neo City oil. You’re hunting the head’s machines? …Good hunting, then.' },
          { who: N, text: 'Bastion follows the oil to Neo City.' },
        ],
      },
      {
        title: 'Under the Lights',
        foe: 'monoceros',
        arena: 'city',
        goal: 'Find out who sends the drones.',
        before: [
          { who: 'monoceros', text: 'You! The silent salad! My drones keep vanishing in your forest!' },
          { who: 'bastion', text: '…' },
          { who: 'monoceros', text: 'Those drones fetch survey bots for my client. Small bots fit in small sockets. It’s SCIENCE.' },
          { who: 'bastion', text: '……' },
        ],
        after: [
          { who: N, text: 'Bastion leaves with a stolen schematic. Every page is stamped with a hellhound’s head.' },
          { who: N, text: 'The schematic marks a caravan route through Sandglass Pass. Bastion goes to meet it.' },
        ],
      },
      {
        title: 'The Caravan',
        foe: 'rex',
        arena: 'sandglass',
        goal: 'Free the caged survey bots.',
        before: [
          { who: N, text: 'A caravan of cages rolls through the narrow middle of Sandglass Pass. Rex Saur is driving it.' },
          { who: 'rex', text: 'Back in my day we didn’t cage little ones. …This job stinks.' },
          { who: 'bastion', text: '…' },
          { who: 'rex', text: 'But the hound’s paying, and you’re in my way. Let’s bite.' },
        ],
        after: [
          { who: N, text: 'The cage doors swing open. Dozens of survey bots pour out and scurry after the mantis into the trees.' },
          { who: 'rex', text: 'Hmph. I’ll tell the hound the bug ate them. It’ll believe that.' },
          { who: N, text: 'Bastion leads the freed bots home, past the haunted grove below the Spire.' },
        ],
      },
      {
        title: 'Two Shadows',
        foe: 'nightshade',
        arena: 'forest',
        goal: 'Learn what the other shadow knows.',
        before: [
          { who: N, text: 'In the haunted grove below the Spire, a second shadow waits. It does not hide.' },
          { who: 'nightshade', text: 'You hunt what hunts the small. So do I, in my way.' },
          { who: 'bastion', text: '…' },
          { who: 'nightshade', text: 'Then let us see which shadow is quieter.' },
        ],
        after: [
          { who: 'nightshade', text: 'The silverback is coming for you. It believes you took the little ones.' },
          { who: 'nightshade', text: 'Show it the truth, hunter. If it lets you.' },
        ],
      },
      {
        title: 'The Silverback',
        foe: 'violet',
        arena: 'forest',
        goal: 'Show Silverback the survey bots are safe.',
        before: [
          { who: 'violet', text: 'You’ve hunted enough little ones. Stand behind me, all of you.' },
          { who: 'bastion', text: '……' },
          { who: 'violet', text: 'Where are they? Answer me!' },
          { who: 'bastion', text: '…' },
        ],
        after: [{ who: N, text: 'The silverback stops. Its palm blasters go dark.' }],
      },
    ],
    ending: [
      { who: N, text: 'The silverback falls to one knee. Bastion folds its scythes and steps aside.' },
      { who: N, text: 'From the dark between the roots, the survey bots crawl out one by one. Every one of them safe.' },
      { who: 'violet', text: 'You… kept them. All this time.' },
      { who: N, text: 'For the first time, the forest is silent because of Bastion, not around it.' },
      { who: 'bastion', text: '…satisfied.' },
    ],
  },
  nightshade: {
    title: 'Waiting at the Top',
    intro: [
      { who: N, text: 'At the top of the Spire, a hooded frame drifts above its single tail.' },
      { who: N, text: 'Below it, the Crystal Court fills with rescued keystones, and the Spire stirs in its sleep.' },
      { who: 'nightshade', text: 'My sibling is climbing. Let us make sure it is ready.' },
      { who: 'nightshade', text: 'And let us make sure there is still something at the top to climb to.' },
    ],
    chapters: [
      {
        title: 'Proof Is Cheap',
        foe: 'liger',
        arena: 'river',
        goal: 'Test what the League’s fighters fight for.',
        before: [
          { who: N, text: 'Nightshade drifts down from the Spire to test the League’s fighters. At River Dusk, Fang Hound wants a fight.' },
          { who: 'liger', text: 'Ghost. They say you’re unbeatable. I say prove it.' },
          { who: 'nightshade', text: 'Proof is cheap. Watch.' },
          { who: 'liger', text: 'You don’t even look at me.' },
          { who: 'nightshade', text: 'I see you well enough. You fight for a crown you do not understand.' },
        ],
        after: [
          { who: 'nightshade', text: 'Go and ask your King what a crown is for. Then come back.' },
          { who: N, text: 'Nightshade goes to the palace field, to ask the King itself.' },
        ],
      },
      {
        title: 'Crowns Are Metal',
        foe: 'kabuto',
        arena: 'soccer',
        goal: 'Remind the crown it swore to keep the gates.',
        before: [
          { who: 'kabuto', text: 'Even ghosts kneel to the crown.' },
          { who: 'nightshade', text: 'Crowns are only metal.' },
          { who: 'kabuto', text: 'This crown swore to keep the gates. The treaty says so.' },
          { who: 'nightshade', text: 'Then keep them, King. They are going dark while you wait for the season.' },
        ],
        after: [
          { who: 'kabuto', text: '…Words. The crown buys its own truths, ghost.' },
          { who: N, text: 'Nightshade returns toward the Spire. In the haunted grove below it, something is watching.' },
        ],
      },
      {
        title: 'The Other Shadow',
        foe: 'bastion',
        arena: 'forest',
        goal: 'Learn whether the forest hunter is friend or foe.',
        before: [
          { who: N, text: 'In the haunted grove below the Spire, something with scythes watches Nightshade pass.' },
          { who: 'bastion', text: '…' },
          { who: 'nightshade', text: 'A hunter who does not speak. We will get along.' },
          { who: 'bastion', text: '……' },
        ],
        after: [
          { who: N, text: 'Bastion melts into the fog. That night, a crimson shape drops another stolen keystone at the Spire’s door.' },
          { who: 'nightshade', text: 'Thank you, ace. Seven gates dark. The Spire is counting.' },
          { who: N, text: 'The stolen stones come out of Sandglass Pass. Nightshade goes to see who guards the hound’s road.' },
        ],
      },
      {
        title: 'The Pair',
        foe: 'rex',
        arena: 'sandglass',
        goal: 'Learn what the old soldier remembers of you.',
        before: [
          { who: 'rex', text: 'I know you. Back in my day, they locked you at the top of that tower.' },
          { who: 'nightshade', text: 'No one locked me, old soldier. I chose to stay.' },
          { who: 'rex', text: 'Hmph. You and the shiny one were built as a pair. One to measure the stones, one to keep ’em.' },
          { who: 'nightshade', text: 'And my sibling forgot. So I keep alone.' },
        ],
        after: [
          { who: 'rex', text: 'It forgot ’cause they wiped it, so nobody could use it to open the gates. You know that, right?' },
          { who: 'nightshade', text: 'I know. It is why I call it, and why I fear it coming.' },
          { who: N, text: 'A tremor runs up the Spire. Nightshade flies home to the Crystal Court.' },
        ],
      },
      {
        title: 'The Court Is Closed',
        foe: 'tyrant',
        arena: 'crystal',
        goal: 'Keep Tyrant King out of the Crystal Court.',
        before: [
          { who: N, text: 'Tyrant King smashes into the Crystal Court, a gate-puller clamped in its wolf-head fists.' },
          { who: 'tyrant', text: 'So this is where the Baron hides my stones. Every arena will have my name on the gate. Even this one.' },
          { who: 'nightshade', text: 'The Court is closed, hound.' },
          { who: 'tyrant', text: 'Nothing is closed to me.' },
        ],
        after: [
          { who: 'tyrant', text: 'I’ll be back. With every stone left in the League.' },
          { who: 'nightshade', text: 'Then my sibling must be ready. It is time.' },
          { who: N, text: 'Nightshade rises to the Orbital Deck, where the pair was built, to call Seraph.' },
        ],
      },
      {
        title: 'Let Us Measure',
        foe: 'angel',
        arena: 'space',
        goal: 'See if your sibling is ready for the Spire.',
        before: [
          { who: N, text: 'On the Orbital Deck, where they were both built, Nightshade waits for its sibling.' },
          { who: 'angel', text: 'Every frame since was measured against me.' },
          { who: 'nightshade', text: 'And I was the one they hid. Let us measure, sibling.' },
          { who: 'angel', text: 'Why call me now?' },
          { who: 'nightshade', text: 'Because the Spire is waking, and it needs both of us. Show me you can stand beside me.' },
        ],
        after: [{ who: N, text: 'The Orbital Deck falls quiet. Only the signal hums.' }],
      },
    ],
    ending: [
      { who: N, text: 'Seraph kneels on the Orbital Deck, and Nightshade lowers its staff.' },
      { who: 'nightshade', text: 'You are strong, sibling. But you do not remember yet.' },
      { who: 'nightshade', text: 'Not today. Rise, and climb again. I will be waiting.' },
      { who: N, text: 'Far below, the Spire’s signal softens. For the first time in an age, it sounds like a heartbeat.' },
    ],
  },
  violet: {
    title: 'Stand Behind Me',
    intro: [
      { who: N, text: 'The little survey bots of Snowfield have stopped coming home.' },
      { who: N, text: 'First one, then five, then the whole morning shift. Only scrape marks lead away into the snow.' },
      { who: 'violet', text: 'Someone is hunting the small ones. Stand behind me.' },
      { who: 'violet', text: 'I will find them. All of them.' },
    ],
    chapters: [
      {
        title: 'Back in Your Day',
        foe: 'rex',
        arena: 'snow',
        goal: 'Find out who took the survey bots.',
        before: [
          { who: 'rex', text: 'Shiny little bots. Back in my day they were a snack.' },
          { who: 'violet', text: 'Back in your day is over.' },
          { who: 'rex', text: 'Hmph. Big talk for a big monkey.' },
          { who: 'violet', text: 'Left, right, left.' },
        ],
        after: [
          { who: 'rex', text: 'Wasn’t me that took ’em, if that’s what you’re asking. Ask the marshal about the caravans.' },
          { who: N, text: 'The marshal patrols Neo City. Silverback goes to find it.' },
        ],
      },
      {
        title: 'Missing Persons',
        foe: 'pioneer',
        arena: 'city',
        goal: 'Make the marshal help you find the bots.',
        before: [
          { who: 'pioneer', text: 'Missing survey bots? Ma’am, that’s not really my department.' },
          { who: 'violet', text: 'They are small, and they are missing. Make it your department.' },
          { who: 'pioneer', text: 'There’s a form for this, you know—' },
          { who: 'violet', text: 'Stand behind me. Fill in the form after.' },
        ],
        after: [{ who: 'pioneer', text: 'Okay, okay! A caravan of cages went through Sandglass Pass last week. No permit. Hellhound banner.' }],
      },
      {
        title: 'The Empty Cages',
        foe: 'liger',
        arena: 'sandglass',
        goal: 'Learn what happened to the caged bots.',
        before: [
          { who: N, text: 'In the narrow middle of Sandglass Pass, the cages lie open and empty. Fang Hound is sniffing them.' },
          { who: 'liger', text: 'I tracked this caravan too. Someone got here first.' },
          { who: 'violet', text: 'Where are they? What did you do?' },
          { who: 'liger', text: 'Nothing, big one. But I’ll fight you if you don’t believe me.' },
        ],
        after: [
          { who: 'liger', text: 'Look at the tracks. Four legs, long body, something with scythes. Round the cages, then off toward the forest.' },
          { who: 'violet', text: '…Bastion.' },
          { who: N, text: 'But first, the one who ordered the cages. Tyrant King sits in the Lava Forge, so Silverback goes there.' },
        ],
      },
      {
        title: 'Left, Right, Left',
        foe: 'tyrant',
        arena: 'lava',
        goal: 'Make Tyrant King tell you where the bots went.',
        before: [
          { who: 'tyrant', text: 'The bots? I sent them to the forest. Bastion was hungry.' },
          { who: 'violet', text: 'Then you’re next. Left, right, left.' },
          { who: 'tyrant', text: 'They were tools, ape. Small enough to crawl into a keystone socket and pry it loose.' },
          { who: 'violet', text: 'They were not tools. They were mine to protect.' },
        ],
        after: [
          { who: 'tyrant', text: 'Ask the head who designed the cages. And ask the bug where they went.' },
          { who: N, text: 'Silverback goes to Neo City to find the head.' },
        ],
      },
      {
        title: 'The Perfect Size',
        foe: 'monoceros',
        arena: 'cyber',
        goal: 'Make the cage designer tell the truth.',
        before: [
          { who: 'monoceros', text: 'Ah, the large primate. Yes, I measured your bots. They are the PERFECT size. Be flattered.' },
          { who: 'violet', text: 'You helped cage them.' },
          { who: 'monoceros', text: 'I helped DESIGN. Caging was the hound’s idea. Morally, that’s a very different—' },
          { who: 'violet', text: 'Stand back.' },
        ],
        after: [
          { who: 'monoceros', text: 'For what it’s worth, they never arrived. Something in the forest took them. My drones never came back either.' },
          { who: 'violet', text: 'Then I go to the forest. Not one more.' },
        ],
      },
      {
        title: 'Not One More',
        foe: 'bastion',
        arena: 'forest',
        goal: 'Bring the survey bots home.',
        before: [
          { who: N, text: 'The Rainy Forest is dark and dripping. Two scythes open between the trees.' },
          { who: 'bastion', text: '…' },
          { who: 'violet', text: 'Not one more.' },
          { who: 'bastion', text: '……' },
          { who: 'violet', text: 'Give them back. Or I take them back.' },
        ],
        after: [{ who: N, text: 'The scythes lower. The whole forest holds its breath.' }],
      },
    ],
    ending: [
      { who: N, text: 'Bastion sinks low, scythes folded. It does not strike again. It steps aside.' },
      { who: N, text: 'One by one, the survey bots crawl out of the forest and gather around the silverback.' },
      { who: 'violet', text: 'You hid them. From the hound. From everyone.' },
      { who: 'bastion', text: '…' },
      { who: 'violet', text: 'Thank you. …Everyone home. Good.' },
    ],
  },
  kabuto: {
    title: 'A Crown Is Kept',
    intro: [
      { who: N, text: 'The floating palace has a king again. Not the one it lost.' },
      { who: N, text: 'Three seasons ago, while the true King was away at the Spire, Leo King took the throne in one night and sealed the palace behind it.' },
      { who: N, text: 'Since then the gates have been going dark, and the palace treasury has never been fuller.' },
      { who: 'kabuto', text: 'A crown belongs to whoever is wearing it. Let them come.' },
    ],
    chapters: [
      {
        title: 'A Stolen Gift',
        foe: 'baron',
        arena: 'cyber',
        goal: 'Claim the stolen Sandglass keystone for the crown.',
        before: [
          { who: N, text: 'Word reaches the palace: the Crimson Baron has landed in Neo City with a stolen keystone. Leo King goes down to collect it.' },
          { who: 'baron', text: 'Your majesty! It’s the Sandglass keystone, darling. Lifted from the hound’s own vault.' },
          { who: 'kabuto', text: 'Stolen goods belong to the crown. Hand it over.' },
          { who: 'baron', text: 'It goes back in its gate. That’s the whole point.' },
          { who: 'kabuto', text: 'It goes where the crown says. Tyrant King pays well for its own stones.' },
        ],
        after: [
          { who: 'baron', text: 'You’re selling it back? The old King would never…' },
          { who: 'kabuto', text: 'There is no old King. Remember that, Baron.' },
          { who: N, text: 'Stone in hand, Leo King takes the beach road south toward Sandglass Pass, where Tyrant’s buyers wait.' },
        ],
      },
      {
        title: 'Can I Wear It?',
        foe: 'ember',
        arena: 'beach',
        goal: 'Keep the stolen keystone moving to market.',
        before: [
          { who: N, text: 'On the beach road, a little axolotl blocks the way, staring at the crown.' },
          { who: 'ember', text: 'Ooh! A real king! Can I wear the crown? Just for one second? Half a second?' },
          { who: 'kabuto', text: 'Out of my road, little one.' },
          { who: 'ember', text: 'Okay! Then I’ll win it! Right now!' },
        ],
        after: [
          { who: 'ember', text: 'Hey… the name inside your crown is scratched out. Is it a borrowed one?' },
          { who: 'kabuto', text: 'Forget what you saw.' },
          { who: N, text: 'Past the dunes lies Sandglass Pass. Tyrant’s toll gate stands in its narrow middle, and the buyer is waiting there.' },
        ],
      },
      {
        title: 'Settling the Toll',
        foe: 'rex',
        arena: 'sandglass',
        goal: 'Sell the keystone to Tyrant’s buyers.',
        before: [
          { who: 'rex', text: 'Toll’s three marbles, cub. Or you can turn around.' },
          { who: 'kabuto', text: 'I am not paying. I am selling. Fetch your boss.' },
          { who: 'rex', text: 'Hmph. Back in my day, kings fought the hound. They didn’t trade with it.' },
        ],
        after: [
          { who: 'rex', text: 'Your old guard saw you take the hound’s gold the night the Forge burned. That’s why it left.' },
          { who: 'rex', text: 'Want a bigger price? The boss is at the Forge. Go and haggle with it yourself.' },
          { who: N, text: 'Leo King heads for the Lava Forge, to name its price to Tyrant King in person.' },
        ],
      },
      {
        title: 'One Crown',
        foe: 'tyrant',
        arena: 'lava',
        goal: 'Name a higher price to Tyrant King in person.',
        before: [
          { who: 'tyrant', text: 'You took my gold and let me burn the Forge. Now you want more?' },
          { who: 'kabuto', text: 'The price has gone up. They say the old King is coming home.' },
          { who: 'tyrant', text: 'One crown. One king. And I decide which one.' },
        ],
        after: [
          { who: 'tyrant', text: 'Fine. Then hurry to the Crystal Court. The Spire can seal a crown for good, before the exile gets there.' },
          { who: N, text: 'Leo King climbs the Spire, to have the Crystal Court seal the stolen crown forever.' },
        ],
      },
      {
        title: 'The Spire’s Judgement',
        foe: 'nightshade',
        arena: 'crystal',
        goal: 'Have the Spire seal your stolen crown.',
        before: [
          { who: 'nightshade', text: 'The Spire seals the crown of whoever keeps the gates. You sold them.' },
          { who: 'kabuto', text: 'The Spire seals the crown of whoever reaches it. Stand aside.' },
          { who: 'nightshade', text: 'Then prove the crown is more than metal.' },
        ],
        after: [
          { who: 'nightshade', text: 'Win all you like. The Spire will not seal a stolen crown.' },
          { who: 'nightshade', text: 'And the one it belongs to has come home. It is waiting for you by the river.' },
          { who: N, text: 'With no seal from the Spire, there is only one way left to keep the crown: beat the exile.' },
        ],
      },
      {
        title: 'Two Kings',
        foe: 'trueleo',
        arena: 'river',
        goal: 'Keep the throne from the true King.',
        before: [
          { who: 'trueleo', text: 'You wear my cape well. It never fit you.' },
          { who: 'kabuto', text: 'Exiles don’t get crowns.' },
          { who: 'trueleo', text: 'I didn’t come for the crown. I came for the kingdom you sold.' },
          { who: 'kabuto', text: 'Then take it, if you can.' },
        ],
        after: [{ who: N, text: 'The true King falls back into the river, and the copy stands alone on the bank.' }],
      },
    ],
    ending: [
      { who: 'kabuto', text: 'The crown stays with me.' },
      { who: N, text: 'Back at the palace, every seat in the great hall is empty. Not one fighter came to kneel.' },
      { who: 'kabuto', text: '…Next season, then. Let them come.' },
      { who: N, text: 'Far below, the exile climbs out of the river, and turns toward the palace again.' },
    ],
  },
  trueleo: {
    title: 'The Rightful Crown',
    intro: [
      { who: N, text: 'Three seasons ago, the King of the League left the floating palace to renew the treaty at the Spire.' },
      { who: N, text: 'When it came home, a copy was wearing its crown and its face. The palace gates were shut, and the true King was driven out.' },
      { who: N, text: 'Now the copy sells keystones to Tyrant King, and the gates go dark one by one.' },
      { who: 'trueleo', text: 'I left the crown once. I will not leave the kingdom twice.' },
      { who: 'trueleo', text: 'To take it back I need proof, an ally, and the Spire’s word. So I start where the sold stones go.' },
    ],
    chapters: [
      {
        title: 'The Exile',
        foe: 'bastion',
        arena: 'sandglass',
        goal: 'Prove you are no spy for Tyrant King.',
        before: [
          { who: N, text: 'Hooded and alone, the true King follows a Tyrant caravan into Sandglass Pass.' },
          { who: 'bastion', text: 'You’ve been trailing the caravan for three days. Who are you working for?' },
          { who: 'trueleo', text: 'No one. That is my whole problem.' },
          { who: 'bastion', text: 'Then show me your face, or show me your fists.' },
        ],
        after: [
          { who: 'bastion', text: '…Those cannons. You fight like the King used to, before it started selling us out.' },
          { who: 'trueleo', text: 'That is because I am the King. The one on the throne is not.' },
          { who: 'bastion', text: 'If that’s true, you need proof. The Crimson Baron logs every stolen stone. It flies out of Neo City.' },
          { who: N, text: 'The true King heads north to Neo City, to find the Baron and its ledger.' },
        ],
      },
      {
        title: 'The Ledger',
        foe: 'baron',
        arena: 'cyber',
        goal: 'Win the Baron’s ledger as proof.',
        before: [
          { who: 'baron', text: 'Two Leo Kings in one season? Darling, one of you owes me money.' },
          { who: 'trueleo', text: 'I need your ledger. Every stone the palace sold to Tyrant.' },
          { who: 'baron', text: 'My books are private. Win them, if you’re so royal.' },
        ],
        after: [
          { who: 'baron', text: 'Every sale, stamped with the royal seal. Your copy got greedy.' },
          { who: 'baron', text: 'Proof is nice, but a crown needs a guard. Yours went north to Snowfield when the copy took the throne.' },
          { who: N, text: 'Ledger in hand, the true King turns north toward Snowfield to find Fang Hound.' },
        ],
      },
      {
        title: 'The Guard Who Left',
        foe: 'liger',
        arena: 'snow',
        goal: 'Prove to Fang Hound you are the real King.',
        before: [
          { who: 'liger', text: 'Another Leo King. I’ve had enough of those.' },
          { who: 'trueleo', text: 'Fang. You left the palace the night it fell.' },
          { who: 'liger', text: 'I left the night my King stopped being my King. Prove you’re the real one.' },
          { who: 'trueleo', text: 'You never listen to words. Fight me, then.' },
        ],
        after: [
          { who: 'liger', text: '…Left, then right. You still drop your guard to the left. It IS you.' },
          { who: 'liger', text: 'The copy let the Forge burn because Tyrant paid it to. Tyrant still sits in those pits.' },
          { who: N, text: 'With Fang Hound at its side, the true King marches on the Lava Forge to face the buyer.' },
        ],
      },
      {
        title: 'The Buyer',
        foe: 'tyrant',
        arena: 'lava',
        goal: 'Make Tyrant King give back the sold stones.',
        before: [
          { who: 'tyrant', text: 'The exile. Your copy is a much better customer.' },
          { who: 'trueleo', text: 'Every stone you bought from it goes back in its gate.' },
          { who: 'tyrant', text: 'Then win them back, one marble at a time.' },
        ],
        after: [
          { who: 'tyrant', text: 'Too late, old lion. Your copy is already climbing to the Crystal Court. Once the Spire seals its crown, it’s king forever.' },
          { who: N, text: 'The true King climbs the Spire, to reach the Crystal Court before the copy’s crown is sealed.' },
        ],
      },
      {
        title: 'The Spire’s Word',
        foe: 'nightshade',
        arena: 'crystal',
        goal: 'Win the Spire’s word before the copy is sealed.',
        before: [
          { who: 'nightshade', text: 'Two crowns climbed my Spire today. Only one has kept a gate.' },
          { who: 'trueleo', text: 'I kept none. I was gone, and I let a copy sell them.' },
          { who: 'nightshade', text: 'Honest. Now prove you can keep them from here on.' },
        ],
        after: [
          { who: 'nightshade', text: 'The Spire refused your copy. It fled down to the palace field to win the crowd instead.' },
          { who: 'nightshade', text: 'Beat it in front of everyone, and no one will doubt which King is true.' },
          { who: N, text: 'The true King descends to the palace field, where the whole League is watching.' },
        ],
      },
      {
        title: 'The Rightful Crown',
        foe: 'kabuto',
        arena: 'soccer',
        goal: 'Take back your crown in front of the League.',
        before: [
          { who: 'kabuto', text: 'Exiles don’t get crowns.' },
          { who: 'trueleo', text: 'And copies don’t get kingdoms. Give it back.' },
          { who: 'kabuto', text: 'I kept the throne warm for three seasons. You ran.' },
          { who: 'trueleo', text: 'I came back. That is the part you never planned for.' },
        ],
        after: [{ who: N, text: 'The stolen crown rolls across the turf, and stops at the true King’s feet.' }],
      },
    ],
    ending: [
      { who: N, text: 'The crowd rises. The copy flees the field without its crown.' },
      { who: 'liger', text: 'Welcome home, my King.' },
      { who: 'trueleo', text: 'Not your King, Fang. Your partner. We have a lot of gates to light.' },
      { who: N, text: 'One by one, the sold keystones go back in their gates, and the palace opens to everyone again.' },
    ],
  },
  tyrant: {
    title: 'My Name on Every Gate',
    intro: [
      { who: N, text: 'Tyrant King has taken the Forge. Now it wants the rest.' },
      { who: N, text: 'With a gate-puller bought in Neo City, it prises the keystones loose one arena at a time.' },
      { who: 'tyrant', text: 'Every arena will have my name on the gate.' },
      { who: 'tyrant', text: 'And when I hold them all, the Spire opens for me.' },
    ],
    chapters: [
      {
        title: 'Through You',
        foe: 'liberty',
        arena: 'beach',
        goal: 'Pull the beach keystone from its gate.',
        before: [
          { who: N, text: 'First on the list: the tide gate at Island Beach, and the stone under its sand.' },
          { who: 'liberty', text: 'I don’t move.' },
          { who: 'tyrant', text: 'Then I go through you.' },
          { who: 'liberty', text: 'The beach stone stays in the sand.' },
          { who: 'tyrant', text: 'Everything stays somewhere. Until I want it.' },
        ],
        after: [
          { who: N, text: 'The tide gate goes dark, and Tyrant King’s banner rises over Island Beach.' },
          { who: N, text: 'With the beach stone in its vault, Tyrant King rides to its toll gate in Sandglass Pass.' },
        ],
      },
      {
        title: 'Toll Road',
        foe: 'pioneer',
        arena: 'sandglass',
        goal: 'Keep your toll gate open in Sandglass Pass.',
        before: [
          { who: 'pioneer', text: 'Tyrant King! Toll gates on League rail need a permit.' },
          { who: 'tyrant', text: 'I am the permit, marshal.' },
          { who: 'pioneer', text: 'That’s not how permits work.' },
          { who: 'tyrant', text: 'It is now.' },
        ],
        after: [
          { who: 'pioneer', text: 'I’m writing this up! In detail! …Ow.' },
          { who: 'tyrant', text: 'Write my name in big letters.' },
          { who: N, text: 'Mandrill keeps sending bills for the puller. Tyrant King goes to Neo City to settle up.' },
        ],
      },
      {
        title: 'Late Payment',
        foe: 'monoceros',
        arena: 'city',
        goal: 'Settle your debt with Mandrill, your way.',
        before: [
          { who: 'monoceros', text: 'You owe me for the puller. In full. With interest. With EXTRA interest for rudeness.' },
          { who: 'tyrant', text: 'I’ll pay you in gates, little genius.' },
          { who: 'monoceros', text: 'I don’t want gates. I want marbles. Lots of them.' },
        ],
        after: [
          { who: 'monoceros', text: 'Fine, a free fact, since you’re sitting on my head. You never got the Forge stone. It fell somewhere warm.' },
          { who: 'tyrant', text: '…The springs.' },
          { who: N, text: 'Before the springs, word comes: the Baron is loading stolen vault stones at the cloud docks above the Snowfield. Tyrant goes after it.' },
        ],
      },
      {
        title: 'Thief of Thieves',
        foe: 'baron',
        arena: 'snow',
        goal: 'Take your stolen stones back from the Baron.',
        before: [
          { who: N, text: 'High in the cloud docks, the Crimson Baron is loading crates. Every crate is stamped with Tyrant’s seal.' },
          { who: 'tyrant', text: 'My vault. My stones. You’re a dead ace, Baron.' },
          { who: 'baron', text: 'Darling! You found me. Smile for the crowd!' },
          { who: 'tyrant', text: 'I had you grounded once. This time I’ll have you scrapped.' },
        ],
        after: [
          { who: 'baron', text: 'Too slow, dear. Those stones are already on their way up the Spire. Where your paws can’t reach.' },
          { who: 'tyrant', text: 'Nothing is out of my reach. Nothing.' },
          { who: N, text: 'Tyrant King storms back to Sandglass Pass. Rex Saur is waiting at the gate, and it is not happy.' },
        ],
      },
      {
        title: 'The Dino Kings Split',
        foe: 'rex',
        arena: 'sandglass',
        goal: 'Put the traitor Rex Saur in its place.',
        before: [
          { who: 'rex', text: 'I’m done, hound. I set those keystones with my own jaws in the old wars. You’re pulling them out.' },
          { who: 'tyrant', text: 'You ride for the fights, old fossil. Not the plans.' },
          { who: 'rex', text: 'Then here’s a fight. Back in my day, we bit traitors.' },
          { who: 'tyrant', text: 'The Dino Kings don’t need you. They need me.' },
        ],
        after: [
          { who: 'tyrant', text: 'Who needs a partner? I have two wolves on my fists, and they never argue.' },
          { who: N, text: 'Alone, Tyrant King heads for the Lava Forge and its hot springs, to find the lost stone. Wyvern’s crews have taken the pits back.' },
        ],
      },
      {
        title: 'Burn It Again',
        foe: 'dragon',
        arena: 'lava',
        goal: 'Crush Wyvern and take the Forge for good.',
        before: [
          { who: 'dragon', text: 'Five engines, one grudge. You burned my home.' },
          { who: 'tyrant', text: 'And I’ll burn it again.' },
          { who: 'dragon', text: 'The crews are back. The pits are ours. Turn around while you can still walk.' },
          { who: 'tyrant', text: 'I don’t turn around. I take.' },
        ],
        after: [{ who: N, text: 'The last of Wyvern’s engines sputters out. The pit goes silent.' }],
      },
    ],
    ending: [
      { who: N, text: 'Wyvern falls in its own pits, and the hellhound’s banner goes up over one more gate.' },
      { who: N, text: 'But when Tyrant King tears the hot springs apart, they are empty. A little lizard and its egg are long gone.' },
      { who: 'tyrant', text: 'Cold furnaces. A stone I can’t find. A Spire I can’t climb. …Yet.' },
      { who: 'tyrant', text: 'Gate after gate, my name. Next season, the Spire.' },
      { who: N, text: 'High above, the Spire’s signal grows louder.' },
    ],
  },
  rex: {
    title: 'Back in My Day',
    intro: [
      { who: N, text: 'Rex Saur wakes up from a nap to find the League has gone soft. Again.' },
      { who: 'rex', text: 'Too shiny. Too fast. Too many buttons. Let’s fix that.' },
      { who: N, text: 'These days it rides with Tyrant King. For the fights, it says. Not the plans.' },
    ],
    chapters: [
      {
        title: 'No Biting',
        foe: 'pioneer',
        arena: 'city',
        goal: 'Show the shiny new marshal how fights used to go.',
        before: [
          { who: N, text: 'Rex Saur stomps into Neo City, looking for the shiniest fighters it can find.' },
          { who: 'pioneer', text: 'Sir, you can’t bite other fighters.' },
          { who: 'rex', text: 'Watch me.' },
          { who: 'pioneer', text: 'There’s a whole section in the rulebook about it!' },
          { who: 'rex', text: 'Back in my day, the rulebook was teeth.' },
        ],
        after: [
          { who: 'pioneer', text: 'Fine! But I’m reporting this to the League. And to your… boss.' },
          { who: 'rex', text: 'I don’t have a boss. I have a ride.' },
          { who: N, text: 'Its ride is waiting at the Lava Forge. So is Wyvern.' },
        ],
      },
      {
        title: 'No Sides',
        foe: 'dragon',
        arena: 'lava',
        goal: 'Show Wyvern that there are no sides.',
        before: [
          { who: 'dragon', text: 'Old timer! You’re on the wrong side.' },
          { who: 'rex', text: 'There’s no sides. Only biting.' },
          { who: 'dragon', text: 'The hound burned my Forge! You’re riding with an arsonist!' },
          { who: 'rex', text: 'I ride for the fights, scrap pile.' },
        ],
        after: [
          { who: 'dragon', text: 'You fought in the old wars. You of all bots should know what a gate means.' },
          { who: 'rex', text: '…Hmph. Don’t lecture your elders.' },
          { who: N, text: 'Grumbling, Rex Saur wanders down to River Dusk to cool off. Fang Hound is there.' },
        ],
      },
      {
        title: 'Young Blood',
        foe: 'liger',
        arena: 'river',
        goal: 'Put the runaway guard in its place.',
        before: [
          { who: 'liger', text: 'Rex Saur. Still running with the hound?' },
          { who: 'rex', text: 'Still running away from your King?' },
          { who: 'liger', text: 'I walked. There’s a difference. Unlike you, I know what I’m walking toward.' },
        ],
        after: [
          { who: 'liger', text: 'The hound is pulling keystones, old timer. Your keystones. The ones from the old wars.' },
          { who: 'rex', text: '…Mine?' },
          { who: N, text: 'Rex Saur heads for Sandglass Pass, to see its old gate with its own eyes.' },
        ],
      },
      {
        title: 'The Gate I Set',
        foe: 'tyrant',
        arena: 'sandglass',
        goal: 'Make Tyrant King answer for your gate.',
        before: [
          { who: N, text: 'At Sandglass Pass, the gate stands dark and empty. Rex Saur remembers setting its stone.' },
          { who: 'rex', text: 'I set that stone with my own jaws, before the treaty ink was dry. You pulled it out.' },
          { who: 'tyrant', text: 'Stones are just marbles, fossil. Ride with me or get out of my pass.' },
          { who: 'rex', text: 'Back in my day, we bit traitors.' },
        ],
        after: [
          { who: 'rex', text: 'The Dino Kings are done. I fought one war to set these gates. I’ll fight another to keep ’em.' },
          { who: N, text: 'To keep the gates, Rex needs to know what is missing. It climbs to the Crystal Court.' },
        ],
      },
      {
        title: 'Old Soldier',
        foe: 'nightshade',
        arena: 'crystal',
        goal: 'Learn which keystone is still missing.',
        before: [
          { who: N, text: 'Rex Saur climbs the Spire for the first time since the old wars. The Crystal Court hums around it.' },
          { who: 'nightshade', text: 'Old soldier. You laid the first stone in this court.' },
          { who: 'rex', text: 'And you were the quiet one at the top. Still are. Show me what’s missing.' },
          { who: 'nightshade', text: 'Fight first. Then I will tell you.' },
        ],
        after: [
          { who: 'nightshade', text: 'One stone is lost: the Forge’s. It sleeps in the hot springs, with the little one.' },
          { who: 'rex', text: 'Of course it does. Of COURSE it does.' },
          { who: N, text: 'Rex Saur stomps down to the hot springs by the Lava Forge, to fetch the stone itself.' },
        ],
      },
      {
        title: 'Not Your Grandpa',
        foe: 'ember',
        arena: 'lava',
        goal: 'Make sure the Forge stone gets home safe.',
        before: [
          { who: 'ember', text: 'Grandpa Rex! Did you come to play?!' },
          { who: 'rex', text: 'I am NOT your grandpa.' },
          { who: 'ember', text: 'You came all the way to the springs! You missed me!' },
          { who: 'rex', text: 'I came for that egg, kid. It’s not an egg. Hand it over and nobody gets bitten.' },
          { who: 'ember', text: 'Nooo! Play first!' },
        ],
        after: [{ who: N, text: 'The little one bounces off Rex Saur’s nose with a squeak.' }],
      },
    ],
    ending: [
      { who: N, text: 'Blossom tumbles into the hot springs, giggling, still hugging its egg tight.' },
      { who: 'rex', text: 'Kids these days. …Fine. It was a good fight.' },
      { who: 'rex', text: 'Keep it, little one. You kept it warmer than any furnace. Now take it home to the Forge.' },
      { who: 'ember', text: 'Really?! Grandpa Rex, you’re the BEST!' },
      { who: 'rex', text: 'NOT your grandpa.' },
      { who: N, text: 'Rex Saur stomps home for another nap. It is smiling. A little.' },
    ],
  },
  liger: {
    title: 'My Own Crown',
    intro: [
      { who: N, text: 'Fang Hound walked out of the palace with nothing but its flank blasters.' },
      { who: N, text: 'The night a stranger took the throne wearing its King’s face, the royal guard could not stand still and watch.' },
      { who: 'liger', text: 'I left the crown to earn my own.' },
    ],
    chapters: [
      {
        title: 'Bodyguard Wanted',
        foe: 'baron',
        arena: 'cyber',
        goal: 'Prove you answer to no one now.',
        before: [
          { who: N, text: 'Fang Hound drifts into Neo City, looking for fights and a name of its own.' },
          { who: 'baron', text: 'A runaway guard! I could use a bodyguard.' },
          { who: 'liger', text: 'I don’t guard anyone anymore.' },
          { who: 'baron', text: 'Pity. My cargo’s very valuable. Keystones, darling, fresh from the hound’s vault.' },
          { who: 'liger', text: 'Then guard them yourself.' },
        ],
        after: [
          { who: 'baron', text: 'Shame. You’d look smashing in red. If you want a fight that matters, follow the dark gates.' },
          { who: N, text: 'The nearest dark gate is at the Snowfield. Fang Hound heads north.' },
        ],
      },
      {
        title: 'Old Habits',
        foe: 'violet',
        arena: 'snow',
        goal: 'Prove you are done being a guard.',
        before: [
          { who: 'violet', text: 'You fight like you’re still protecting someone.' },
          { who: 'liger', text: 'Habit. Let’s break it.' },
          { who: 'violet', text: 'Some habits are worth keeping.' },
        ],
        after: [
          { who: 'violet', text: 'You moved in front of a survey bot. Twice. You are still a guard, Fang.' },
          { who: 'liger', text: '…Don’t tell anyone.' },
          { who: N, text: 'Fang Hound takes the cloud road above the palace. Closer to home than it will admit.' },
        ],
      },
      {
        title: 'The Yardstick',
        foe: 'angel',
        arena: 'snow',
        goal: 'Measure yourself against the first frame.',
        before: [
          { who: N, text: 'On the cloud road above the palace, Fang Hound meets the first frame ever built.' },
          { who: 'liger', text: 'Seraph. Every frame is measured against you. Measure me.' },
          { who: 'angel', text: 'Measure yourself against what you are for, not against me.' },
          { who: 'liger', text: 'I’m for winning.' },
          { who: 'angel', text: 'Then win. And tell me if it was enough.' },
        ],
        after: [
          { who: 'angel', text: 'You fought well. But you kept looking back toward the palace.' },
          { who: 'liger', text: 'I did not.' },
          { who: 'angel', text: 'You did.' },
          { who: N, text: 'To stop looking back, Fang seeks the ghost below the Spire, in the Rainy Forest.' },
        ],
      },
      {
        title: 'What Crowns Are For',
        foe: 'nightshade',
        arena: 'forest',
        goal: 'Learn what a crown is truly for.',
        before: [
          { who: 'nightshade', text: 'The runaway guard. You left to wear a crown.' },
          { who: 'liger', text: 'I left to earn one.' },
          { who: 'nightshade', text: 'Then ask what a crown is for, before you put it on.' },
        ],
        after: [
          { who: 'nightshade', text: 'The old crowns swore to keep the gates. A crown that keeps nothing is only metal.' },
          { who: 'liger', text: '…Then what am I keeping?' },
          { who: N, text: 'Then word comes: Tyrant King has a crown to give away, at the Lava Forge. Fang goes to see it.' },
        ],
      },
      {
        title: 'A Crown for Sale',
        foe: 'tyrant',
        arena: 'lava',
        goal: 'Turn down the crown Tyrant King offers you.',
        before: [
          { who: N, text: 'In the stolen pits of the Forge, Tyrant King waits with a gift: a crown, forged from a dark gate.' },
          { who: 'tyrant', text: 'Kneel to me, hunter, and I’ll put your name on a gate of your own. No King required.' },
          { who: 'liger', text: 'A crown you give me isn’t one I earned.' },
          { who: 'tyrant', text: 'Then earn a beating.' },
        ],
        after: [
          { who: 'liger', text: 'I almost took it. That’s what scares me.' },
          { who: 'liger', text: 'The copy on the throne sells the gates. The hound buys them. There has to be a third way.' },
          { who: N, text: 'Fang Hound heads home to the palace field, to call out the false King in front of the whole League.' },
        ],
      },
      {
        title: 'Come Home, Fang',
        foe: 'kabuto',
        arena: 'soccer',
        goal: 'Call out the false King before the League.',
        before: [
          { who: 'kabuto', text: 'Come home, Fang. Kneel, and you can guard the crown again.' },
          { who: 'liger', text: 'You’re not my King. My King would never sell a gate.' },
          { who: 'kabuto', text: 'Your King ran away. I stayed.' },
          { who: 'liger', text: 'Then fight me, copy. No rules, no season.' },
        ],
        after: [{ who: N, text: 'The false King’s cape hits the turf, and the crowd falls silent.' }],
      },
    ],
    ending: [
      { who: N, text: 'The copy flees the field. In the stands, a lion in a travel-worn cape rises to its feet.' },
      { who: 'trueleo', text: 'You kept the palace gate, Fang, even when I could not.' },
      { who: 'liger', text: 'My King. …I earned my own crown. I’ll still guard yours.' },
      { who: 'trueleo', text: 'Not as my guard. As my equal.' },
      { who: N, text: 'Side by side, two crowns ride out from the palace toward the nearest dark gate.' },
    ],
  },
  ember: {
    title: 'Ooh, What Does This Do?',
    intro: [
      { who: N, text: 'The smallest fighter in the League climbs out of the hot springs, ready for everything.' },
      { who: N, text: 'It carries its favourite thing in the world: a warm, glowing egg it found the night the Forge burned.' },
      { who: 'ember', text: 'Ooh, what does THIS button do?' },
      { who: 'ember', text: 'Come on, egg! We’re going on an adventure!' },
    ],
    chapters: [
      {
        title: 'Big Head, Big Buttons',
        foe: 'monoceros',
        arena: 'city',
        goal: 'Find out what all the lab buttons do.',
        before: [
          { who: N, text: 'Blossom’s first stop is the brightest place it has heard of: Neo City, full of buttons.' },
          { who: 'monoceros', text: 'A tiny lizard. In MY lab. Touching MY buttons.' },
          { who: 'ember', text: 'This one is orange! Orange is the best one!' },
          { who: 'monoceros', text: 'Do NOT press the— wait. What is that you’re holding?' },
          { who: 'ember', text: 'My egg! Isn’t it pretty?' },
        ],
        after: [
          { who: 'monoceros', text: 'Interesting. VERY interesting. Run along, newt. And keep that egg somewhere very safe.' },
          { who: N, text: 'Keeping the egg safe, Blossom wanders into the quiet of the Rainy Forest.' },
        ],
      },
      {
        title: 'A Very Quiet Friend',
        foe: 'bastion',
        arena: 'forest',
        goal: 'Make friends with the quiet forest bot.',
        before: [
          { who: 'bastion', text: '…' },
          { who: 'ember', text: 'Hi! You’re very quiet. Do you want to be friends?' },
          { who: 'bastion', text: '……' },
          { who: 'ember', text: 'I’ll take that as a yes!' },
        ],
        after: [
          { who: N, text: 'Bastion steps back into the dark. Dozens of tiny survey bots peek out from behind its legs.' },
          { who: 'ember', text: 'Oooh, you have friends too! Bye, friends!' },
          { who: N, text: 'The forest stream runs down to Island Beach. Blossom follows it, chasing bubbles.' },
        ],
      },
      {
        title: 'So Many Bubbles!',
        foe: 'liberty',
        arena: 'beach',
        goal: 'Get a close look at the reef’s bubbles.',
        before: [
          { who: 'ember', text: 'Bubbles! The reef has SO many bubbles!' },
          { who: 'liberty', text: 'This reef is closed, little one. Go home.' },
          { who: 'ember', text: 'Is that a rule? Can I see the rule?' },
          { who: 'liberty', text: 'I am the rule. I don’t move.' },
        ],
        after: [{ who: 'liberty', text: 'You fight fair. Listen: that egg hums like a gate. Hold it close. Someone will come for it.' }],
      },
      {
        title: 'The Egg Collector',
        foe: 'baron',
        arena: 'beach',
        goal: 'Keep your egg away from the Baron.',
        before: [
          { who: 'baron', text: 'Ooh, what a sweet little thing. And what a sweeter little egg. Mind if I borrow it, darling?' },
          { who: 'ember', text: 'No! It’s mine! I found it!' },
          { who: 'baron', text: 'I collect shiny things for a very good cause. Smile for the crowd!' },
        ],
        after: [
          { who: 'baron', text: 'All right, keep it. But that’s no egg, sweetheart. It’s the Lava Forge’s keystone. Its heart.' },
          { who: 'baron', text: 'The hound would pull your tail off for it. Take it home, and keep your head down.' },
          { who: 'ember', text: 'My egg is a… HEART?' },
        ],
      },
      {
        title: 'Five Loud Engines',
        foe: 'dragon',
        arena: 'lava',
        goal: 'Bring your egg safely home to the Forge.',
        before: [
          { who: N, text: 'Blossom carries its egg to the cold Forge. Wyvern stomps out of the ash.' },
          { who: 'dragon', text: 'Kid! Is that— THAT’S OUR FORGE STONE! Give it here!' },
          { who: 'ember', text: 'No! You’re yelling! It doesn’t like yelling!' },
          { who: 'dragon', text: 'Kid, I’m not gonna— okay, fine. Warm-up round!' },
        ],
        after: [
          { who: 'dragon', text: 'Sorry, kid. Five engines, all yelling at once. You kept it safe this whole time?' },
          { who: 'ember', text: 'Uh huh! I kept it warm. Eggs like warm. Hearts like warm too, I think.' },
          { who: N, text: 'But first Blossom wants Grandpa Rex to see its heart. Off it runs to the Snowfield.' },
        ],
      },
      {
        title: 'Grandpa Rex',
        foe: 'rex',
        arena: 'snow',
        goal: 'Prove you can carry the Forge stone yourself.',
        before: [
          { who: N, text: 'Before Blossom can roll the egg in, a grumpy old shape blocks the road through the snow.' },
          { who: 'rex', text: 'You. The little one. You never stop talking.' },
          { who: 'ember', text: 'Grandpa Rex! Let’s play!' },
          { who: 'rex', text: 'That stone’s not going to the hound. But I’m not letting a baby carry it, either.' },
          { who: 'ember', text: 'I’m not a baby! I’m a HOTHEAD! It says so on my card!' },
        ],
        after: [{ who: N, text: 'Rex Saur wobbles. Then it topples.' }],
      },
    ],
    ending: [
      { who: N, text: 'Rex Saur sits down in the snow with a thump, beaten by the League’s favourite underdog.' },
      { who: 'rex', text: 'Hmph. Fine. You carry it. You’ve earned that much.' },
      { who: N, text: 'Back at the Forge, Blossom rolls its egg into the cold furnace. The pits roar to life, and the crews cheer.' },
      { who: 'ember', text: 'It hatched! Sort of! It hatched into FIRE!' },
      { who: 'ember', text: 'That was SO fun. Again? Again again again?' },
    ],
  },
};

/** each chapter a little harder: two easy, two normal, two hard */
export const CHAPTER_DIFF = ['easy', 'easy', 'normal', 'normal', 'hard', 'hard'] as const;
/** bonus XP for finishing a story */
export const STORY_BONUS = 300;
