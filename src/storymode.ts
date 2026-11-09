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
      { who: N, text: 'A signal, a strange call only Seraph can hear, comes from the Spire, the League’s giant tower.' },
      { who: N, text: 'Arena gates are going dark, shutting down without keystones, the stones that keep them working.' },
      { who: 'angel', text: 'Every robot since was measured against me. Now I want to know why.' },
      { who: 'angel', text: 'The answer is at the top. So I climb.' },
    ],
    chapters: [
      {
        title: 'No Licence to Climb',
        foe: 'pioneer',
        arena: 'city',
        goal: 'Beat Pioneer so you can start climbing the Spire.',
        before: [
          { who: N, text: 'The Spire road starts in Neo City, where Pioneer, the League’s police robot, checks every climber.' },
          { who: 'pioneer', text: 'Seraph! You’re heading for the Spire without a licence. Pull over!' },
          { who: 'angel', text: 'I don’t have a licence. I don’t have much of anything. Only the signal.' },
          { who: 'pioneer', text: 'Signals aren’t my department. Unlicensed climbing is.' },
          { who: 'angel', text: 'Then write me a ticket, Pioneer. After the fight.' },
        ],
        after: [
          { who: 'pioneer', text: 'Fine, go. But if you see Crimson Baron on the Serpent Run, it’s mine. Don’t touch it.' },
          { who: N, text: 'Seraph takes the Serpent Run, the only road up toward the Spire.' },
        ],
      },
      {
        title: 'Crimson Baron’s Cargo',
        foe: 'baron',
        arena: 'serpent',
        goal: 'Beat Crimson Baron to learn what it is carrying up the Spire.',
        before: [
          { who: N, text: 'Halfway up the Serpent Run, Crimson Baron is flying the same way.' },
          { who: 'baron', text: 'Well, if it isn’t Seraph itself! Smile, darling, you’re in my slipstream.' },
          { who: 'angel', text: 'You’re carrying something heavy. It hums like the signal.' },
          { who: 'baron', text: 'Precious cargo for the top floor. Ask no questions and I’ll tell you no lies.' },
          { who: 'angel', text: 'I have nothing but questions.' },
        ],
        after: [
          { who: 'baron', text: 'All right, one answer, down here where no one’s listening. My buyer lives at the top of the Spire. It has your face, darling.' },
          { who: N, text: 'High above these ruins, past the Serpent Run, lies the Snowfield. Silverback guards it.' },
        ],
      },
      {
        title: 'Snowfield Wall',
        foe: 'violet',
        arena: 'snow',
        goal: 'Beat Silverback to prove you can survive the climb.',
        before: [
          { who: 'violet', text: 'The Spire eats little machines. Stand behind me, or get past me.' },
          { who: 'angel', text: 'I was built to stand in front, not behind.' },
          { who: 'violet', text: 'Then show me you can take a hit. The climb is worse.' },
        ],
        after: [
          { who: 'violet', text: 'Measured. You fight like robots from the treaty, the old peace deal that ended the wars. Ask Leo King.' },
          { who: N, text: 'Leo King has come down to the far side of the Snowfield. Seraph heads across the ice to ask it.' },
        ],
      },
      {
        title: 'The Treaty',
        foe: 'kabuto',
        arena: 'snow',
        goal: 'Beat Leo King to learn why your memory was wiped.',
        before: [
          { who: N, text: 'Out on the open Snowfield, come down from its palace in the clouds, Leo King is waiting.' },
          { who: 'kabuto', text: 'Seraph. The first of us. You stood here once, the day the treaty was signed.' },
          { who: 'angel', text: 'I don’t remember that.' },
          { who: 'kabuto', text: 'You measured every keystone before it was set in a gate. Then your makers made you forget.' },
          { who: 'angel', text: 'Why?' },
          { who: 'kabuto', text: 'That is a secret a crown only tells to those who beat it. Earn the rest, Seraph.' },
        ],
        after: [
          { who: 'kabuto', text: 'Whoever holds your memory could open every gate at once. So they wiped it, to keep the League safe.' },
          { who: 'angel', text: 'They didn’t wipe me to hide me. They wiped me so no one could use me.' },
          { who: 'kabuto', text: 'And now someone is opening the gates the slow way. Hurry.' },
          { who: N, text: 'From the bottom of the Frozen Caverns, Seraph heads for the Crystal Court, atop the Spire, where the rescued keystones are kept.' },
        ],
      },
      {
        title: 'The Crystal Court',
        foe: 'dragon',
        arena: 'crystal',
        goal: 'Beat Wyvern to protect the keystones in the Crystal Court.',
        before: [
          { who: N, text: 'High on the Spire, open to the sky, the Crystal Court glitters. Stolen keystones hum among its great crystals.' },
          { who: 'dragon', text: 'You! The Spire’s hoarding keystones! Where’s the one from MY Forge?' },
          { who: 'angel', text: 'These were stolen back from Tyrant King and brought here to keep. I can feel each one.' },
          { who: 'dragon', text: 'Then feel this, shiny. Five engines, one grudge!' },
        ],
        after: [
          { who: 'angel', text: 'Your keystone isn’t here, Wyvern. It never left the Forge. Something small and warm is keeping it.' },
          { who: 'dragon', text: '…The springs. Blossom. I’m going home.' },
          { who: N, text: 'The signal drops, down to the Neon District. Its source has left the Spire, and Seraph dives after it.' },
        ],
      },
      {
        title: 'Meet Yourself',
        foe: 'nightshade',
        arena: 'cyber',
        goal: 'Beat Nightshade, the robot calling you, so you can remember.',
        before: [
          { who: N, text: 'Under the holo signs of the Neon District, hooded Nightshade drifts above a single tail.' },
          { who: 'nightshade', text: 'You climbed so high, and I came down here to meet you.' },
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
      { who: N, text: 'Seraph and Nightshade reach up to the Spire’s heart from the neon below, and its signal changes. It is no longer a call. It is an answer.' },
      { who: N, text: 'Across the League, gates that went dark begin, one by one, to glow again.' },
      { who: 'angel', text: 'Every robot is measured against me. Then I will make sure the measure is fair.' },
    ],
  },
  dragon: {
    title: 'Five Engines, One Grudge',
    intro: [
      { who: N, text: 'The Lava Forge’s furnaces are cold ash, and its pits now answer to Tyrant King.' },
      { who: N, text: 'Tyrant King’s gate-puller did it, a machine that rips out keystones, the stones that keep gates working.' },
      { who: 'dragon', text: 'The crews built me out of scrap. Every part of me remembers a pit that used to roar.' },
      { who: 'dragon', text: 'I’ll win them their name back. Loudly.' },
    ],
    chapters: [
      {
        title: 'Warm-Up Round',
        foe: 'ember',
        arena: 'lava',
        goal: 'Beat Blossom to warm up for winning the Forge back.',
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
        title: 'Leo King Won’t Brawl',
        foe: 'kabuto',
        arena: 'sandglass',
        goal: 'Beat Leo King to win its help against Tyrant King.',
        before: [
          { who: N, text: 'Tyrant King’s toll gate stands far up Sandglass Pass. Here in its narrow middle, Leo King is passing through.' },
          { who: 'dragon', text: 'Your majesty! Tyrant King burned my home. Ride with me and we’ll tear its gates down!' },
          { who: 'kabuto', text: 'The crown does not brawl outside the season. There are rules, Wyvern.' },
          { who: 'dragon', text: 'Rules didn’t stop the fire!' },
          { who: 'kabuto', text: 'Then show me a grudge is worth more than a rule.' },
        ],
        after: [
          { who: 'kabuto', text: '…Even among these dead, you hit like a whole pit crew. I will think on what you said.' },
          { who: 'dragon', text: 'Think fast. Who built the gate-puller that tore the Forge apart?' },
          { who: 'kabuto', text: 'Ask in Neo City. Ask Mandrill.' },
        ],
      },
      {
        title: 'The Gate-Puller',
        foe: 'monoceros',
        arena: 'city',
        goal: 'Beat Mandrill, the gate-puller’s maker, to make it answer for the Forge.',
        before: [
          { who: 'monoceros', text: 'A dino-scrap brute on MY street. Wipe your feet. Actually, you have five sets. Wipe all of them.' },
          { who: 'dragon', text: 'You built the gate-puller. You killed my Forge.' },
          { who: 'monoceros', text: 'I INVENTED a gate-puller. Selling it to Tyrant King was business. Using it was Tyrant King.' },
          { who: 'dragon', text: 'Then I’ll do business with your face.' },
        ],
        after: [
          { who: 'monoceros', text: 'Fine! A free fact, since you’re standing on my cannon. Tyrant King never got your Forge keystone.' },
          { who: 'monoceros', text: 'When the pit burned, the keystone fell somewhere. Tyrant King is still searching for it.' },
          { who: N, text: 'Wyvern heads for the Snowfield. Rex Saur, Tyrant King’s old soldier, keeps watch there. It knows where keystones go.' },
        ],
      },
      {
        title: 'Overpaid, Old Timer',
        foe: 'rex',
        arena: 'snow',
        goal: 'Beat Rex Saur to learn where the Forge keystone went.',
        before: [
          { who: 'rex', text: 'Tyrant King pays me to stop you. Back in my day we did it for free.' },
          { who: 'dragon', text: 'Then you’re overpaid, old timer.' },
          { who: 'rex', text: 'Watch your mouth, scrap pile. I was setting keystones before your parts were welded.' },
          { who: 'dragon', text: 'Then tell me where mine went!' },
        ],
        after: [{ who: 'rex', text: 'Hmph. It’s not down this hole, and Tyrant King never found it. Ask the Spire, the League’s giant tower. It counts every keystone.' }],
      },
      {
        title: 'Up the Serpent Run',
        foe: 'angel',
        arena: 'serpent',
        goal: 'Beat Seraph so you can search the Spire for your keystone.',
        before: [
          { who: N, text: 'Wyvern stomps up the Serpent Run toward the Spire. Seraph stands in the bend.' },
          { who: 'angel', text: 'Turn back, Wyvern. The Spire is no place for a grudge.' },
          { who: 'dragon', text: 'The Spire keeps stolen keystones. If mine is up there, I’m taking it home.' },
          { who: 'angel', text: 'Then you’ll have to get past me first.' },
        ],
        after: [
          { who: 'angel', text: 'Your keystone was never stolen. I can feel it, far below. Something small and warm is keeping it.' },
          { who: 'dragon', text: 'Small. Warm. Never shuts up about its egg… BLOSSOM.' },
          { who: N, text: 'Wyvern races back down to the Lava Forge, to reach Blossom before Tyrant King does.' },
        ],
      },
      {
        title: 'The Pit Is Ours',
        foe: 'tyrant',
        arena: 'lava',
        goal: 'Save Blossom and take the Forge back from Tyrant King.',
        before: [
          { who: N, text: 'Back at the Forge, Blossom is cornered against the lava, clutching its egg. Tyrant King looms over it.' },
          { who: 'tyrant', text: 'So you had it all along, little one. Hand it over, and I’ll put your name on a very small gate.' },
          { who: 'ember', text: 'No! It’s my egg! …It is an egg, right?' },
          { who: 'dragon', text: 'Get behind me, kid. Hey, Tyrant King! Your name on every gate? Not this one.' },
          { who: 'tyrant', text: 'This burnt-out pit? I’ll burn it again.' },
          { who: 'dragon', text: 'This pit built me. Five engines, one grudge.' },
        ],
        after: [{ who: N, text: 'Tyrant King’s banner tears loose and burns up in the lava.' }],
      },
    ],
    ending: [
      { who: N, text: 'Tyrant King crashes into the ash. Blossom peeks out from behind Wyvern, egg held high.' },
      { who: 'ember', text: 'Is it… not an egg?' },
      { who: 'dragon', text: 'It’s our heart, kid. Go on. Roll it in.' },
      { who: N, text: 'The keystone drops into the lava, and the Lava Forge roars back to life.' },
      { who: N, text: 'The pit crews paint a new name across the rocks: WYVERN.' },
      { who: 'dragon', text: 'Light ’em up. We’re open again.' },
    ],
  },
  pioneer: {
    title: 'The Long Chase',
    intro: [
      { who: N, text: 'Rare marbles are vanishing between arenas, and every lead points to Crimson Baron, a flying smuggler.' },
      { who: N, text: 'Arena gates are going dark, shutting down one by one. The League wants answers.' },
      { who: 'pioneer', text: 'Pioneer, League police, on patrol. Nobody smuggles on my watch.' },
      { who: 'pioneer', text: 'Crimson Baron’s been one jump ahead of me for three seasons. Not this one.' },
    ],
    chapters: [
      {
        title: 'Licence and Marbles',
        foe: 'liger',
        arena: 'river',
        goal: 'Beat Fang Hound to get a lead on Crimson Baron.',
        before: [
          { who: N, text: 'Crimson Baron was last seen over River Dusk. Fang Hound was there that night.' },
          { who: 'liger', text: 'I don’t answer to Leo King, and I don’t answer to cops.' },
          { who: 'pioneer', text: 'You’ll answer to the League, then. Licence and marbles, please.' },
          { who: 'liger', text: 'You want Crimson Baron. It flew over the river last night, heading for Neo City.' },
          { who: 'pioneer', text: 'Thank you for the tip. You’re still getting a ticket.' },
        ],
        after: [{ who: 'liger', text: 'Ask Mandrill in Neo City. It sells maps to anyone with marbles.' }],
      },
      {
        title: 'The Route Maps',
        foe: 'monoceros',
        arena: 'city',
        goal: 'Beat Mandrill to learn Crimson Baron’s route.',
        before: [
          { who: 'monoceros', text: 'Crimson Baron? I sold it the route maps. I am a genius, not a criminal.' },
          { who: 'pioneer', text: 'You can be both. Hands where I can see them. Er, cannons.' },
          { who: 'monoceros', text: 'I sold Tyrant King a gate-puller too, a machine that rips keystones out of gates. Check your book.' },
          { who: 'pioneer', text: 'Keystones, the stones that keep gates working? Checking now.' },
        ],
        after: [
          { who: 'monoceros', text: 'Fine. It’s on these charts. Crimson Baron flies the vault route, out across the desert. Happy?' },
          { who: 'pioneer', text: 'Vault route? Whose vault?' },
          { who: 'monoceros', text: 'Oh, you really don’t know. Delicious.' },
          { who: N, text: 'Next stop: Sandglass Pass, out across the desert, on Crimson Baron’s vault route.' },
        ],
      },
      {
        title: 'Obstructing the Law',
        foe: 'violet',
        arena: 'sandglass',
        goal: 'Beat Silverback to find out what Crimson Baron is really stealing.',
        before: [
          { who: N, text: 'At Sandglass Pass, Pioneer finds Silverback blocking the road. Broken cages lie scattered among the rocks.' },
          { who: 'violet', text: 'Stand behind me. Someone kept survey bots, the tiny scout robots, in those. Now they are empty.' },
          { who: 'pioneer', text: 'Ma’am, you’re obstructing a crime scene.' },
          { who: 'violet', text: 'I am standing in it. Left, right, left.' },
        ],
        after: [
          { who: 'violet', text: 'Those cages came through this pass under Tyrant King’s banner. Crimson Baron flew over them and didn’t stop.' },
          { who: 'pioneer', text: 'So Crimson Baron isn’t robbing caravans. It’s robbing… vaults. Tyrant King’s vaults?' },
          { who: N, text: 'A question that big needs Leo King. Pioneer rides to the Soccer Field, where it holds its matches, to ask.' },
        ],
      },
      {
        title: 'The Bigger Case',
        foe: 'kabuto',
        arena: 'soccer',
        goal: 'Beat Leo King to learn the truth about Crimson Baron’s cargo.',
        before: [
          { who: 'kabuto', text: 'Pioneer. You chase Crimson Baron while a thief puts its name on every gate.' },
          { who: 'pioneer', text: 'With respect, your majesty, I go by the book. Crimson Baron is on page one.' },
          { who: 'kabuto', text: 'Then read further. Show me you can handle a bigger case.' },
        ],
        after: [
          { who: 'kabuto', text: 'Among these tombs, hear this. Tyrant King pulls keystones from gates. Crimson Baron steals them back and flies them to the Spire, the League’s giant tower.' },
          { who: 'kabuto', text: 'Crimson Baron is a thief of thieves, Pioneer. Decide what your book says about that.' },
          { who: N, text: 'Pioneer takes the Serpent Run, Crimson Baron’s road up to the Spire.' },
        ],
      },
      {
        title: 'Ticket, Again',
        foe: 'angel',
        arena: 'serpent',
        goal: 'Beat Seraph to reach the Spire before Crimson Baron gets away.',
        before: [
          { who: N, text: 'On the Serpent Run, the road bends up toward the Spire. Seraph is climbing it.' },
          { who: 'pioneer', text: 'Seraph! You again. Still no licence?' },
          { who: 'angel', text: 'Still no licence. Crimson Baron is ahead of us, Pioneer. It is not the thief you think.' },
          { who: 'pioneer', text: 'Everyone keeps telling me that. The law is the law.' },
          { who: 'angel', text: 'Then let the arena decide who climbs first.' },
        ],
        after: [{ who: 'angel', text: 'The Crystal Court, atop the Spire, keeps every keystone Crimson Baron brings back. Arrest it there, and see what it saved.' }],
      },
      {
        title: 'Crimson Baron, Finally',
        foe: 'baron',
        arena: 'crystal',
        goal: 'Beat Crimson Baron so you can finally arrest it.',
        before: [
          { who: N, text: 'Out among the great crystals of the Crystal Court, Crimson Baron is tucking one more keystone away.' },
          { who: 'baron', text: 'Smile for the crowd, Pioneer! It’s the last thing they’ll see you do.' },
          { who: 'pioneer', text: 'Crimson Baron, you’re under arrest. Finally.' },
          { who: 'baron', text: 'For what, darling? Returning lost property?' },
          { who: 'pioneer', text: 'For flying without a licence. The rest I’ll sort out in the report.' },
        ],
        after: [{ who: N, text: 'Crimson Baron raises both hands, still grinning, and the cuffs click shut.' }],
      },
    ],
    ending: [
      { who: N, text: 'Crimson Baron is towed away, still waving to a crowd only it can see.' },
      { who: 'pioneer', text: 'The keystones stay here, where they belong. And I’m filing a second warrant. Name: Tyrant King.' },
      { who: 'baron', text: 'Pioneer! You’re learning. I’m so proud.' },
      { who: 'pioneer', text: 'You’re still under arrest.' },
      { who: 'pioneer', text: 'Case closed. …Until the next one.' },
    ],
  },
  liberty: {
    title: 'Hold the Line',
    intro: [
      { who: N, text: 'Something is stirring under Island Beach: an old lab, and an older grudge.' },
      { who: N, text: 'Deep beneath the sand sits the beach’s keystone, the stone that keeps the tide gate working.' },
      { who: 'liberty', text: 'I don’t move. Whatever is coming has to come through me.' },
    ],
    chapters: [
      {
        title: 'Not on My Sand',
        foe: 'baron',
        arena: 'beach',
        goal: 'Beat Crimson Baron to keep its cargo off your beach.',
        before: [
          { who: 'baron', text: 'Lovely beach. Shame if someone landed a cargo of marbles on it.' },
          { who: 'liberty', text: 'Not on my sand.' },
          { who: 'baron', text: 'Relax, darling, I’m only passing. It’s the digging under your treads you should worry about.' },
          { who: 'liberty', text: 'I don’t worry. I hold.' },
        ],
        after: [
          { who: 'baron', text: 'Suit yourself. But something’s been tunnelling in from the reef. It laughs. Loudly.' },
          { who: N, text: 'Liberty rolls down Island Beach, toward the reef, to see what is laughing.' },
        ],
      },
      {
        title: 'The Laughing Cave',
        foe: 'ember',
        arena: 'beach',
        goal: 'Beat Blossom to find out what is digging under your beach.',
        before: [
          { who: 'ember', text: 'Hi! Hi! I found a cave in the reef and it goes HA HA HA really loud! Wanna see?' },
          { who: 'liberty', text: 'That reef is closed. Go home, little one.' },
          { who: 'ember', text: 'But I wanna see what the buttons do down there!' },
          { who: 'liberty', text: 'Then you’ll have to get past me. You won’t.' },
        ],
        after: [
          { who: 'ember', text: 'Okay, okay, I’ll go. But this cave has lots of little drones with claws. They looked busy!' },
          { who: 'liberty', text: 'Drones. Under my beach.' },
        ],
      },
      {
        title: 'Something in the Forest',
        foe: 'bastion',
        arena: 'forest',
        goal: 'Beat Bastion to track the drones to whoever sent them.',
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
          { who: N, text: 'The drones came from Neo City. Liberty sets out for Mandrill’s lab, along River Dusk.' },
        ],
      },
      {
        title: 'Grudges Collide',
        foe: 'dragon',
        arena: 'river',
        goal: 'Beat Wyvern to learn why Mandrill wants your beach.',
        before: [
          { who: 'dragon', text: 'Move! Mandrill built a gate-puller, a machine that rips keystones out of gates. It killed my Forge. I’m off to Neo City!' },
          { who: 'liberty', text: 'Mandrill is mine. I sank its lab once. I can do it again.' },
          { who: 'dragon', text: 'Then race me there!' },
          { who: 'liberty', text: 'I don’t race. I don’t move. …Usually.' },
        ],
        after: [
          { who: 'dragon', text: 'Tunnel’s shut, so listen. Tyrant King bought that gate-puller to strip every gate. Mandrill promised it your beach keystone.' },
          { who: 'liberty', text: 'It doesn’t want my armour. It wants my beach.' },
          { who: N, text: 'With the tunnel drowned, Liberty takes the Serpent Run, the quick way round to Neo City.' },
        ],
      },
      {
        title: 'Waited Too Long',
        foe: 'violet',
        arena: 'serpent',
        goal: 'Beat Silverback so you can reach Neo City.',
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
          { who: N, text: 'Liberty rolls on to Neo City, where Mandrill is waiting in the street.' },
        ],
      },
      {
        title: 'Nine Hundred Days',
        foe: 'monoceros',
        arena: 'city',
        goal: 'Beat Mandrill to take the beach keystone back.',
        before: [
          { who: 'monoceros', text: 'You SANK my lab. I have been planning this for nine hundred and twelve days.' },
          { who: 'liberty', text: 'You dug under my beach to steal its keystone.' },
          { who: 'monoceros', text: 'Steal? Borrow forever! Tyrant King pays very well, and you can’t even LEAVE the sand!' },
          { who: 'liberty', text: 'I left it. I came here.' },
          { who: 'monoceros', text: '…That was not in the plan.' },
          { who: 'liberty', text: 'Then you know how it ends.' },
        ],
        after: [{ who: N, text: 'For the first time in nine hundred and twelve days, Mandrill is quiet.' }],
      },
    ],
    ending: [
      { who: N, text: 'Mandrill’s cannons fall silent. Its last drone drops a crate in the street. Inside, the beach keystone is still glowing.' },
      { who: 'liberty', text: 'This goes home.' },
      { who: N, text: 'Liberty carries it home to Island Beach and sets it in place. Far from Neo City, the tide gate shines again.' },
      { who: 'liberty', text: 'The line holds. Sometimes the line has to move first.' },
      { who: 'liberty', text: 'Back to the beach. Someone has to stand guard.' },
    ],
  },
  monoceros: {
    title: 'The Grand Plan',
    intro: [
      { who: N, text: 'Out on a Neo City street, Mandrill’s very large head is laughing.' },
      { who: 'monoceros', text: 'Step one: build a gate-puller, a machine that rips keystones out of gates. Step two: overcharge Tyrant King.' },
      { who: 'monoceros', text: 'Step three: humiliate. Step four: humiliate more. Step five: Liberty.' },
      { who: N, text: 'Its whiteboard is back at the lab, so it scrawls the plan across the road. The road is very full.' },
    ],
    chapters: [
      {
        title: 'Wanted for Questioning',
        foe: 'pioneer',
        arena: 'city',
        goal: 'Beat Pioneer, the League’s police robot, to keep your plan on track.',
        before: [
          { who: 'pioneer', text: 'Mandrill! Step away from that road. You’re wanted for questioning.' },
          { who: 'monoceros', text: 'Question THIS.' },
          { who: 'pioneer', text: 'That’s not an answer, that’s a cannon.' },
          { who: 'monoceros', text: 'A cannon IS an answer, Pioneer. Mine is simply louder.' },
        ],
        after: [
          { who: 'monoceros', text: 'Chalk it on the road: the law is slow. Step three, complete.' },
          { who: N, text: 'Next in the chalk: the Lava Forge. Mandrill wants to know why Tyrant King’s new pits stay cold.' },
        ],
      },
      {
        title: 'Not an Egg',
        foe: 'ember',
        arena: 'lava',
        goal: 'Beat Blossom to find out what it is carrying.',
        before: [
          { who: 'ember', text: 'Your head is SO big. Is it heavy? Can I climb it?' },
          { who: 'monoceros', text: 'Absolutely not. Prepare to be out-thought.' },
          { who: 'ember', text: 'Can my egg climb it?' },
          { who: 'monoceros', text: 'Your… wait. That is not an egg. Hold still, you ridiculous newt.' },
        ],
        after: [
          { who: N, text: 'Blossom scampers off through the foundry with its egg, giggling. Mandrill stares after it.' },
          { who: 'monoceros', text: 'The Forge keystone, a stone that keeps arena gates working, in Blossom’s arms! Tyrant King won’t think to look. Note it.' },
          { who: N, text: 'Mandrill heads to the Snowfield to measure more survey bots, the tiny scout robots. Someone there is waiting.' },
        ],
      },
      {
        title: 'Measuring Little Ones',
        foe: 'violet',
        arena: 'snow',
        goal: 'Beat Silverback to get it off your trail.',
        before: [
          { who: 'violet', text: 'You. Your drones took the little ones from my base.' },
          { who: 'monoceros', text: 'I took MEASUREMENTS. Survey bots are the perfect size for a keystone socket. Science!' },
          { who: 'violet', text: 'Stand behind me, little ones. This one talks too much.' },
          { who: 'monoceros', text: 'Talks? I LECTURE.' },
        ],
        after: [
          { who: 'monoceros', text: 'For the record, the caravan never reached Tyrant King. Something in the forest took it.' },
          { who: 'monoceros', text: 'Tyrant King wants enough keystones to open the Spire, the League’s giant tower. I did not put THAT in the brochure.' },
          { who: N, text: 'Worried, for once, Mandrill heads up the Spire to the Crystal Court.' },
        ],
      },
      {
        title: 'The Spire Answers',
        foe: 'nightshade',
        arena: 'crystal',
        goal: 'Beat Nightshade to find out why the Spire is humming.',
        before: [
          { who: N, text: 'Mandrill climbs to the Crystal Court to see what all the humming is about.' },
          { who: 'nightshade', text: 'So. Mandrill. Your machine is why the Spire screams.' },
          { who: 'monoceros', text: 'Screams? It hums. Pleasantly. I calculated everything.' },
          { who: 'nightshade', text: 'Every gate your gate-puller opens wakes the Spire a little more. Wake it fully, and the League ends for us all.' },
          { who: 'monoceros', text: '…I calculated almost everything.' },
        ],
        after: [
          { who: 'nightshade', text: 'Take your gate-puller back from Tyrant King, Mandrill, before these stars go out. Or there will be no League left to win in.' },
          { who: 'monoceros', text: 'Revised plan. Step four: humiliate TYRANT KING.' },
          { who: N, text: 'From the Star Vault, Mandrill heads for the Serpent Run to switch its gate-puller off. Tyrant King comes looking.' },
        ],
      },
      {
        title: 'Breach of Contract',
        foe: 'tyrant',
        arena: 'serpent',
        goal: 'Beat Tyrant King to take your gate-puller back.',
        before: [
          { who: 'tyrant', text: 'Mandrill. My gate-puller has stopped working. You’ll fix it, or I’ll fix you.' },
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
          { who: 'monoceros', text: 'Not this time, Liberty. I brought the math.' },
          { who: 'liberty', text: 'I heard you broke Tyrant King’s gate-puller. That doesn’t undo selling it.' },
          { who: 'monoceros', text: 'I saved the League AND I still want revenge. I contain multitudes.' },
        ],
        after: [{ who: N, text: 'Liberty’s rifle falls quiet, and then the impossible happens.' }],
      },
    ],
    ending: [
      { who: N, text: 'Liberty’s treads finally roll backwards, one slow metre into the sea.' },
      { who: 'monoceros', text: 'Write it down! Write it ALL down! I am, as predicted, the smartest thing in any arena.' },
      { who: N, text: 'Liberty rises from the surf, and for once, it almost looks like it is smiling.' },
      { who: 'liberty', text: 'One metre. Enjoy it.' },
      { who: 'monoceros', text: 'Step six: buy a bigger whiteboard.' },
    ],
  },
  baron: {
    title: 'One Last Delivery',
    intro: [
      { who: N, text: 'One rare golden marble, a few arenas, and Pioneer, the League’s police robot, on its tail.' },
      { who: N, text: 'Everyone says Crimson Baron is a smuggler. Everyone is half right.' },
      { who: 'baron', text: 'One last delivery, darling. Then I retire. Probably.' },
    ],
    chapters: [
      {
        title: 'Fly Over It',
        foe: 'liberty',
        arena: 'beach',
        goal: 'Beat Liberty to get the golden marble past its beach.',
        before: [
          { who: N, text: 'The route to the Spire, the League’s giant tower, starts over Island Beach. Liberty guards it.' },
          { who: 'liberty', text: 'Not on my sand.' },
          { who: 'baron', text: 'Then I’ll fly over it. Smile!' },
          { who: 'liberty', text: 'What are you carrying?' },
          { who: 'baron', text: 'Gold, honour, the usual. Mostly gold.' },
        ],
        after: [
          { who: 'liberty', text: 'That marble hums like a gate. It’s a keystone, a stone that keeps arena gates working. Go fast.' },
          { who: N, text: 'Crimson Baron flies inland along River Dusk. Leo King is waiting on the bank.' },
        ],
      },
      {
        title: 'Finders Keepers',
        foe: 'kabuto',
        arena: 'river',
        goal: 'Beat Leo King to keep the golden marble out of its hands.',
        before: [
          { who: 'kabuto', text: 'That golden marble belongs to the crown.' },
          { who: 'baron', text: 'Finders keepers, your majesty.' },
          { who: 'kabuto', text: 'Tyrant King’s crew took it from my treasury. Where did you find it?' },
          { who: 'baron', text: 'In Tyrant King’s vault, of course. Shall I put it back there? No? Then shoo.' },
        ],
        after: [
          { who: 'kabuto', text: '…You stole from a thief. I will not chase you out of this hole, Crimson Baron. But Tyrant King will.' },
          { who: N, text: 'From this flooded dock, the fastest way to the Spire runs through Sandglass Pass. Crimson Baron means to take it.' },
        ],
      },
      {
        title: 'Not Your Keystone',
        foe: 'dragon',
        arena: 'sandglass',
        goal: 'Beat Wyvern to get your cargo through Sandglass Pass.',
        before: [
          { who: N, text: 'The narrow middle of Sandglass Pass is blocked by one very angry Wyvern.' },
          { who: 'dragon', text: 'You! Flyboy! That gold marble, is it ours? Is it the Forge keystone?' },
          { who: 'baron', text: 'Not yours, darling. Yours is somewhere much warmer.' },
          { who: 'dragon', text: 'Talk straight or I’ll knock it out of you!' },
        ],
        after: [
          { who: 'baron', text: 'Ask Blossom about its egg sometime. Ta-ta!' },
          { who: 'dragon', text: 'Its… EGG?' },
          { who: N, text: 'Past the desert, Crimson Baron climbs the Serpent Run toward the Spire. Tyrant King has caught up.' },
        ],
      },
      {
        title: 'The Owner Calls',
        foe: 'tyrant',
        arena: 'serpent',
        goal: 'Beat Tyrant King to keep the golden marble.',
        before: [
          { who: 'tyrant', text: 'Crimson Baron. That marble is mine, and so is every keystone you’ve stolen from my vaults.' },
          { who: 'baron', text: 'You stole them first, darling. I just steal better.' },
          { who: 'tyrant', text: 'I had you grounded once. The League listens to me now. I’ll do it again.' },
          { who: 'baron', text: 'You grounded me for refusing to fly your cargo. I’ve been flying it back ever since.' },
        ],
        after: [
          { who: 'baron', text: 'The crowd thinks I’m a thief. Let them. Better a thief than flying Tyrant King’s cargo.' },
          { who: N, text: 'Out of these ruins and past the Serpent Run, the buyer waits in the Rainy Forest.' },
        ],
      },
      {
        title: 'The Buyer’s Test',
        foe: 'nightshade',
        arena: 'forest',
        goal: 'Beat Nightshade to pass the buyer’s test.',
        before: [
          { who: N, text: 'In the Rainy Forest below the Spire, hooded Nightshade drifts out of the mist.' },
          { who: 'nightshade', text: 'Crimson Baron. You are early.' },
          { who: 'baron', text: 'And you’re spooky. Delivery for the top floor. Sign here?' },
          { who: 'nightshade', text: 'Pioneer follows you. Show me you can still win with it watching.' },
        ],
        after: [
          { who: 'nightshade', text: 'Bring it to the Crystal Court, atop the Spire. Every keystone you carried waits there. This one finishes the set.' },
          { who: 'baron', text: 'Finishes? Darling, I’ll need a new hobby.' },
        ],
      },
      {
        title: 'Smile for the Crowd',
        foe: 'pioneer',
        arena: 'crystal',
        goal: 'Beat Pioneer so you can deliver the last keystone to the Crystal Court.',
        before: [
          { who: N, text: 'Among the great crystals of the Crystal Court, one socket stands empty, and Pioneer blocks the way to it.' },
          { who: 'pioneer', text: 'End of the line, Crimson Baron. This time I’ve got you.' },
          { who: 'baron', text: 'Pioneer! I was hoping you’d come. The crowd loves you.' },
          { who: 'pioneer', text: 'You’re a smuggler.' },
          { who: 'baron', text: 'I’m a delivery service. Look around, darling. Everything hidden in these crystals, I brought home.' },
        ],
        after: [{ who: N, text: 'Pioneer goes down among the crystals. The empty socket waits.' }],
      },
    ],
    ending: [
      { who: N, text: 'The golden marble lands in Nightshade’s hands, and the empty socket blazes with light.' },
      { who: 'nightshade', text: 'The set is whole. The Spire can rest. Thank you, Crimson Baron.' },
      { who: N, text: 'By the time Pioneer gets back up, Crimson Baron is already gone.' },
      { who: 'pioneer', text: '…It left me a parking ticket.' },
      { who: 'baron', text: 'Retirement can wait. The crowd can’t.' },
    ],
  },
  bastion: {
    title: 'The Hunt',
    intro: [
      { who: N, text: 'Deep in the Rainy Forest, two scythes open in the dark.' },
      { who: N, text: 'Survey bots, the tiny scout robots, are being snatched from the Snowfield. Something is hunting them.' },
      { who: N, text: 'Something else is hunting it.' },
      { who: 'bastion', text: '…' },
    ],
    chapters: [
      {
        title: 'Clicking in the Dark',
        foe: 'ember',
        arena: 'forest',
        goal: 'Beat Blossom to keep the hidden survey bot safe.',
        before: [
          { who: 'ember', text: 'Hello? Is someone there? I heard clicking.' },
          { who: 'bastion', text: '…' },
          { who: 'ember', text: 'Ooh, are you a tree? You’re a very pointy tree.' },
        ],
        after: [
          { who: N, text: 'Blossom is beaten. Under the leaf where it stood, a tiny survey bot is trembling.' },
          { who: N, text: 'Bastion lifts it on the flat of a scythe and carries it deeper into the dark.' },
          { who: N, text: 'The drones that snatch the bots leave an oil trail. Bastion follows it to River Dusk.' },
        ],
      },
      {
        title: 'On the Scent',
        foe: 'liger',
        arena: 'river',
        goal: 'Beat Fang Hound to shake it off your trail.',
        before: [
          { who: 'liger', text: 'I can smell you, bug. Come out and face me.' },
          { who: 'bastion', text: '…' },
          { who: 'liger', text: 'There’s lab oil all over you. You’ve been tearing up someone’s drones.' },
          { who: 'bastion', text: '…' },
        ],
        after: [
          { who: 'liger', text: 'Neo City oil, all through this grotto. You’re hunting Mandrill’s machines? …Good hunting, then.' },
          { who: N, text: 'Bastion follows the oil to Neo City.' },
        ],
      },
      {
        title: 'Under the Lights',
        foe: 'monoceros',
        arena: 'city',
        goal: 'Beat Mandrill to find out who sends the drones.',
        before: [
          { who: 'monoceros', text: 'You! The silent salad! My drones keep vanishing in your forest!' },
          { who: 'bastion', text: '…' },
          { who: 'monoceros', text: 'Those drones fetch survey bots for my client. Small bots fit in small sockets. It’s SCIENCE.' },
          { who: 'bastion', text: '……' },
        ],
        after: [
          { who: N, text: 'Bastion leaves with stolen plans. Every page is stamped with Tyrant King’s head.' },
          { who: N, text: 'The plans mark a caravan route through Sandglass Pass. Bastion goes to meet it.' },
        ],
      },
      {
        title: 'The Caravan',
        foe: 'rex',
        arena: 'sandglass',
        goal: 'Beat Rex Saur to free the caged survey bots.',
        before: [
          { who: N, text: 'Just past the narrow middle of Sandglass Pass, a caravan of cages has stopped. Its driver, Rex Saur, turns around.' },
          { who: 'rex', text: 'Back in my day we didn’t cage survey bots. …This job stinks.' },
          { who: 'bastion', text: '…' },
          { who: 'rex', text: 'But Tyrant King’s paying, and you’re in my way. Let’s bite.' },
        ],
        after: [
          { who: N, text: 'The cage doors swing open. Dozens of survey bots pour out and scurry after Bastion through the tombs.' },
          { who: 'rex', text: 'Hmph. I’ll tell Tyrant King that Bastion ate them. It’ll believe that.' },
          { who: N, text: 'Bastion leads the freed bots up out of the Crypt, home to the Rainy Forest.' },
        ],
      },
      {
        title: 'Two Shadows',
        foe: 'nightshade',
        arena: 'forest',
        goal: 'Beat Nightshade to learn what it knows.',
        before: [
          { who: N, text: 'In the Rainy Forest, below the Spire, the League’s giant tower, a second shadow waits. It does not hide.' },
          { who: 'nightshade', text: 'You hunt what hunts the small. So do I, in my way.' },
          { who: 'bastion', text: '…' },
          { who: 'nightshade', text: 'Then let us see which shadow is quieter.' },
        ],
        after: [
          { who: 'nightshade', text: 'Silverback is coming for you. It believes you took the survey bots.' },
          { who: 'nightshade', text: 'Show it the truth, hunter. If it lets you.' },
        ],
      },
      {
        title: 'Facing Silverback',
        foe: 'violet',
        arena: 'forest',
        goal: 'Beat Silverback so you can show it the survey bots are safe.',
        before: [
          { who: 'violet', text: 'You’ve hunted enough little ones. Stand behind me, all of you.' },
          { who: 'bastion', text: '……' },
          { who: 'violet', text: 'Where are they? Answer me!' },
          { who: 'bastion', text: '…' },
        ],
        after: [{ who: N, text: 'Silverback stops. Its palm blasters go dark.' }],
      },
    ],
    ending: [
      { who: N, text: 'Silverback falls to one knee. Bastion folds its scythes and steps aside.' },
      { who: N, text: 'From the dark between the roots, the survey bots crawl out one by one. Every one of them safe.' },
      { who: 'violet', text: 'You… kept them. All this time.' },
      { who: N, text: 'For the first time, the forest is silent because of Bastion, not around it.' },
      { who: 'bastion', text: '…satisfied.' },
    ],
  },
  nightshade: {
    title: 'Waiting at the Top',
    intro: [
      { who: N, text: 'Nightshade keeps the Spire, the League’s giant tower. Tonight it drifts over River Dusk on its single tail.' },
      { who: N, text: 'At the Spire, the Crystal Court fills with rescued keystones, the stones that keep arena gates working. The Spire stirs.' },
      { who: 'nightshade', text: 'My sibling Seraph is climbing. Let us make sure it is ready.' },
      { who: 'nightshade', text: 'And let us make sure there is still something at the top to climb to.' },
    ],
    chapters: [
      {
        title: 'Proof Is Cheap',
        foe: 'liger',
        arena: 'river',
        goal: 'Beat Fang Hound to test what the League’s fighters fight for.',
        before: [
          { who: N, text: 'Nightshade has come down from the Spire to test the League’s fighters. At River Dusk, Fang Hound wants a fight.' },
          { who: 'liger', text: 'Ghost. They say you’re unbeatable. I say prove it.' },
          { who: 'nightshade', text: 'Proof is cheap. Watch.' },
          { who: 'liger', text: 'You don’t even look at me.' },
          { who: 'nightshade', text: 'I see you well enough. You fight for a crown you do not understand.' },
        ],
        after: [
          { who: 'nightshade', text: 'Go and ask Leo King what a crown is for. Then come back.' },
          { who: N, text: 'Nightshade goes to the Soccer Field, where Leo King holds its matches, to ask it in person.' },
        ],
      },
      {
        title: 'Crowns Are Metal',
        foe: 'kabuto',
        arena: 'soccer',
        goal: 'Beat Leo King to remind it that it swore to keep the gates.',
        before: [
          { who: 'kabuto', text: 'Even ghosts kneel to the crown.' },
          { who: 'nightshade', text: 'Crowns are only metal.' },
          { who: 'kabuto', text: 'By the treaty, the old peace deal that ended the wars, this crown swore to keep the gates.' },
          { who: 'nightshade', text: 'Then keep them, Leo King. They are going dark, shutting down, while you wait for the season.' },
        ],
        after: [
          { who: 'kabuto', text: '…Words, among old bones. The crown buys its own truths, ghost.' },
          { who: N, text: 'Nightshade rises from the Crypt and returns toward the Spire. In the Rainy Forest below it, something is watching.' },
        ],
      },
      {
        title: 'The Other Shadow',
        foe: 'bastion',
        arena: 'forest',
        goal: 'Beat Bastion to learn if it is friend or foe.',
        before: [
          { who: N, text: 'In a haunted grove of the Rainy Forest, something with scythes watches Nightshade pass.' },
          { who: 'bastion', text: '…' },
          { who: 'nightshade', text: 'A hunter who does not speak. Friend or foe? We will find out.' },
          { who: 'bastion', text: '……' },
        ],
        after: [
          { who: N, text: 'Bastion melts into the fog. That night, Crimson Baron drops another stolen keystone in the grove, at Nightshade’s feet.' },
          { who: 'nightshade', text: 'Thank you, Crimson Baron. Seven gates dark. The Spire is counting.' },
          { who: N, text: 'The stolen keystones come out of Sandglass Pass. Nightshade goes to see who guards Tyrant King’s road.' },
        ],
      },
      {
        title: 'The Pair',
        foe: 'rex',
        arena: 'sandglass',
        goal: 'Beat Rex Saur to learn what it remembers of you.',
        before: [
          { who: 'rex', text: 'I know you. Back in my day, they locked you at the top of that tower.' },
          { who: 'nightshade', text: 'No one locked me, old soldier. I chose to stay.' },
          { who: 'rex', text: 'Hmph. You and Seraph were built as a pair. One to measure the keystones, one to keep ’em.' },
          { who: 'nightshade', text: 'And my sibling forgot. So I keep alone.' },
        ],
        after: [
          { who: 'rex', text: 'Seraph forgot ’cause they wiped it, so nobody could use it to open the gates. You know that, right?' },
          { who: 'nightshade', text: 'I know. It is why I call it, and why I fear it coming.' },
          { who: N, text: 'A tremor shakes the Frozen Caverns, from the Spire far above. Nightshade turns for home, and the Crystal Court.' },
        ],
      },
      {
        title: 'The Court Is Closed',
        foe: 'tyrant',
        arena: 'crystal',
        goal: 'Beat Tyrant King to keep it out of the Crystal Court.',
        before: [
          { who: N, text: 'Tyrant King smashes into the Crystal Court, gripping a gate-puller, a machine that rips keystones out of gates.' },
          { who: 'tyrant', text: 'So this is where Crimson Baron hides my keystones. Every arena will have my name on the gate. Even this one.' },
          { who: 'nightshade', text: 'The Court is closed, Tyrant King.' },
          { who: 'tyrant', text: 'Nothing is closed to me.' },
        ],
        after: [
          { who: 'tyrant', text: 'I’ll be back. With every keystone left in the League.' },
          { who: 'nightshade', text: 'Then my sibling must be ready. It is time.' },
          { who: N, text: 'Nightshade rises to the Orbital Deck, where the pair was built, to call Seraph.' },
        ],
      },
      {
        title: 'Let Us Measure',
        foe: 'angel',
        arena: 'space',
        goal: 'Beat Seraph, your sibling, to see if it is ready for the Spire.',
        before: [
          { who: N, text: 'On the Orbital Deck, where they were both built, Nightshade waits for its sibling.' },
          { who: 'angel', text: 'Every robot since was measured against me.' },
          { who: 'nightshade', text: 'And I was the one they hid. Let us measure, sibling.' },
          { who: 'angel', text: 'Why call me now?' },
          { who: 'nightshade', text: 'Because the Spire is waking, and it needs both of us. Show me you can stand beside me.' },
        ],
        after: [{ who: N, text: 'All is quiet. Only the signal hums, the strange call only Seraph can hear.' }],
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
      { who: N, text: 'The survey bots, the tiny scout robots of the Snowfield, have stopped coming home.' },
      { who: N, text: 'First one, then five, then the whole morning shift. Only scrape marks lead away into the snow.' },
      { who: 'violet', text: 'Someone is hunting the small ones. Stand behind me.' },
      { who: 'violet', text: 'I will find them. All of them.' },
    ],
    chapters: [
      {
        title: 'Back in Your Day',
        foe: 'rex',
        arena: 'snow',
        goal: 'Beat Rex Saur to find out who took the survey bots.',
        before: [
          { who: 'rex', text: 'Shiny little bots. Back in my day they were a snack.' },
          { who: 'violet', text: 'Back in your day is over.' },
          { who: 'rex', text: 'Hmph. Big talk for a big monkey.' },
          { who: 'violet', text: 'Left, right, left.' },
        ],
        after: [
          { who: 'rex', text: 'Wasn’t me that took ’em, if that’s what you’re asking. Ask Pioneer about the caravans.' },
          { who: N, text: 'Pioneer, the League’s police robot, patrols Neo City. Silverback goes to find it.' },
        ],
      },
      {
        title: 'Missing Persons',
        foe: 'pioneer',
        arena: 'city',
        goal: 'Beat Pioneer so it will help you find the survey bots.',
        before: [
          { who: 'pioneer', text: 'Missing survey bots? Ma’am, that’s not really my department.' },
          { who: 'violet', text: 'They are small, and they are missing. Make it your department.' },
          { who: 'pioneer', text: 'There’s a form for this, you know—' },
          { who: 'violet', text: 'Stand behind me. Fill in the form after.' },
        ],
        after: [{ who: 'pioneer', text: 'Okay, okay! It’s in these files! A caravan of cages went through Sandglass Pass last week. No permit. Tyrant King’s banner.' }],
      },
      {
        title: 'The Empty Cages',
        foe: 'liger',
        arena: 'sandglass',
        goal: 'Beat Fang Hound to learn what happened to the caged bots.',
        before: [
          { who: N, text: 'In the narrow middle of Sandglass Pass, Fang Hound is sniffing the sand. Open, empty cages lie scattered back among the rocks.' },
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
        goal: 'Beat Tyrant King to make it tell you where the bots went.',
        before: [
          { who: 'tyrant', text: 'The bots? I sent them to the forest. Bastion was hungry.' },
          { who: 'violet', text: 'Then you’re next. Left, right, left.' },
          { who: 'tyrant', text: 'They were tools, ape. Small enough to pry loose keystones, the stones that keep arena gates working.' },
          { who: 'violet', text: 'They were not tools. They were mine to protect.' },
        ],
        after: [
          { who: 'tyrant', text: 'Ask Mandrill who designed the cages. And ask Bastion where they went.' },
          { who: N, text: 'Down in the Molten Depths, Silverback chooses its next stop: the Neon District, to find Mandrill.' },
        ],
      },
      {
        title: 'The Perfect Size',
        foe: 'monoceros',
        arena: 'cyber',
        goal: 'Beat Mandrill to make it tell the truth about the cages.',
        before: [
          { who: 'monoceros', text: 'Ah, the large primate. Yes, I measured your bots. They are the PERFECT size. Be flattered.' },
          { who: 'violet', text: 'You helped cage them.' },
          { who: 'monoceros', text: 'I helped DESIGN. Caging was Tyrant King’s idea. Morally, that’s a very different—' },
          { who: 'violet', text: 'Stand back.' },
        ],
        after: [
          { who: 'monoceros', text: 'For what it’s worth, they never arrived. Something in the forest took them. My drones never came back either.' },
          { who: 'violet', text: 'Then I go to the Rainy Forest. Not one more.' },
        ],
      },
      {
        title: 'Not One More',
        foe: 'bastion',
        arena: 'forest',
        goal: 'Beat Bastion to bring the survey bots home.',
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
      { who: N, text: 'One by one, the survey bots crawl out of the forest and gather around Silverback.' },
      { who: 'violet', text: 'You hid them. From Tyrant King. From everyone.' },
      { who: 'bastion', text: '…' },
      { who: 'violet', text: 'Thank you. …Everyone home. Good.' },
    ],
  },
  kabuto: {
    title: 'A Crown Is Kept',
    intro: [
      { who: N, text: 'The floating palace has a king again. Not the one it lost.' },
      { who: N, text: 'Three seasons ago, while True Leo King was away at the Spire, its copy, Leo King, took the throne in one night and sealed the palace behind it.' },
      { who: N, text: 'Since then the arena gates have been going dark, shutting down, and the palace treasury has never been fuller.' },
      { who: 'kabuto', text: 'A crown belongs to whoever is wearing it. Let them come.' },
    ],
    chapters: [
      {
        title: 'A Stolen Gift',
        foe: 'baron',
        arena: 'cyber',
        goal: 'Beat Crimson Baron to claim the stolen Sandglass keystone.',
        before: [
          { who: N, text: 'Word reached the palace: Crimson Baron landed in the Neon District with a stolen keystone, a stone that keeps arena gates working. Leo King came for it.' },
          { who: 'baron', text: 'Your majesty! It’s the Sandglass keystone, darling. Lifted from Tyrant King’s own vault.' },
          { who: 'kabuto', text: 'Stolen goods belong to the crown. Hand it over.' },
          { who: 'baron', text: 'It goes back in its gate. That’s the whole point.' },
          { who: 'kabuto', text: 'It goes where the crown says. Tyrant King pays well for its own keystones.' },
        ],
        after: [
          { who: 'baron', text: 'You’re selling it back? True Leo King would never…' },
          { who: 'kabuto', text: 'There is no True Leo King. Remember that, Crimson Baron.' },
          { who: N, text: 'Keystone in hand, Leo King heads south along Island Beach, toward Sandglass Pass, where Tyrant King’s buyers wait.' },
        ],
      },
      {
        title: 'Can I Wear It?',
        foe: 'ember',
        arena: 'beach',
        goal: 'Beat Blossom to keep the stolen keystone moving to market.',
        before: [
          { who: N, text: 'On the sand of Island Beach, Blossom blocks the way, staring at Leo King’s crown.' },
          { who: 'ember', text: 'Ooh! A real king! Can I wear your crown? Just for one second? Half a second?' },
          { who: 'kabuto', text: 'Out of my road, little one.' },
          { who: 'ember', text: 'Okay! Then I’ll win it! Right now!' },
        ],
        after: [
          { who: 'ember', text: 'Hey… I saw it down here! The name inside your crown is scratched out. Is it a borrowed one?' },
          { who: 'kabuto', text: 'Forget what you saw.' },
          { who: N, text: 'Far from this grotto, past the dunes, lies Sandglass Pass. The buyer is waiting in its narrow middle.' },
        ],
      },
      {
        title: 'Settling the Toll',
        foe: 'rex',
        arena: 'sandglass',
        goal: 'Beat Rex Saur to sell the keystone to Tyrant King’s buyers.',
        before: [
          { who: 'rex', text: 'Toll’s three marbles, cub. Or you can turn around.' },
          { who: 'kabuto', text: 'I am not paying. I am selling. Fetch your boss.' },
          { who: 'rex', text: 'Hmph. Back in my day, kings fought Tyrant King. They didn’t trade with it.' },
        ],
        after: [
          { who: 'rex', text: 'Your old guard, Fang Hound, saw you take Tyrant King’s gold the night the Forge burned. That’s why it left.' },
          { who: 'rex', text: 'Want a bigger price? Tyrant King is at the Forge. Go and haggle with it yourself.' },
          { who: N, text: 'Leo King heads for the Lava Forge, to name its price to Tyrant King in person.' },
        ],
      },
      {
        title: 'One Crown',
        foe: 'tyrant',
        arena: 'lava',
        goal: 'Beat Tyrant King to make it pay your higher price.',
        before: [
          { who: 'tyrant', text: 'You took my gold and let me burn the Forge. Now you want more?' },
          { who: 'kabuto', text: 'The price has gone up. They say True Leo King is coming home.' },
          { who: 'tyrant', text: 'One crown. One king. And I decide which one.' },
        ],
        after: [
          { who: 'tyrant', text: 'Fine. Out of my strongroom. Hurry to the Crystal Court. The Spire, the League’s giant tower, can seal a crown for good, before True Leo King arrives.' },
          { who: N, text: 'Leo King climbs the Spire, to have the Crystal Court seal the stolen crown forever.' },
        ],
      },
      {
        title: 'The Spire’s Judgement',
        foe: 'nightshade',
        arena: 'crystal',
        goal: 'Beat Nightshade so the Spire will seal your stolen crown.',
        before: [
          { who: 'nightshade', text: 'The Spire seals a crown for whoever keeps the gates. You sold them.' },
          { who: 'kabuto', text: 'The Spire seals the crown of whoever reaches it. Stand aside.' },
          { who: 'nightshade', text: 'Then prove that crown is more than metal.' },
        ],
        after: [
          { who: 'nightshade', text: 'Win all you like. The Spire will not seal a stolen crown.' },
          { who: 'nightshade', text: 'And its true owner, True Leo King, has come home. It is waiting for you at River Dusk.' },
          { who: N, text: 'With no seal from the Spire, there is only one way left to keep that crown: beat True Leo King.' },
        ],
      },
      {
        title: 'Two Kings',
        foe: 'trueleo',
        arena: 'river',
        goal: 'Beat True Leo King to keep the throne.',
        before: [
          { who: 'trueleo', text: 'You wear my cape well. It never fit you.' },
          { who: 'kabuto', text: 'Exiles don’t get crowns.' },
          { who: 'trueleo', text: 'I didn’t come for that crown. I came for the kingdom you sold.' },
          { who: 'kabuto', text: 'Then take it, if you can.' },
        ],
        after: [{ who: N, text: 'True Leo King falls back into the river, and Leo King stands alone on the bank.' }],
      },
    ],
    ending: [
      { who: 'kabuto', text: 'The crown stays with me.' },
      { who: N, text: 'Back at the palace, every seat in the great hall is empty. Not one fighter came to kneel.' },
      { who: 'kabuto', text: '…Next season, then. Let them come.' },
      { who: N, text: 'At River Dusk, True Leo King climbs out of the water, and turns toward the palace again.' },
    ],
  },
  trueleo: {
    title: 'The Rightful Crown',
    intro: [
      { who: N, text: 'Three seasons ago, True Leo King left the palace to renew the treaty, the old peace deal that ended the wars, at the Spire.' },
      { who: N, text: 'When it came home, a copy called Leo King wore its crown and its face. The palace gates were shut, and True Leo King was driven out.' },
      { who: N, text: 'Leo King sells Tyrant King keystones, the stones that keep arena gates working. One by one, gates go dark.' },
      { who: 'trueleo', text: 'I left my crown once. I will not leave the kingdom twice.' },
      { who: 'trueleo', text: 'I need proof, an ally, and the word of the Spire, the League’s giant tower. So I start where the sold keystones go.' },
    ],
    chapters: [
      {
        title: 'True Leo King Returns',
        foe: 'bastion',
        arena: 'sandglass',
        goal: 'Beat Bastion to prove you are no spy for Tyrant King.',
        before: [
          { who: N, text: 'Hooded and alone, True Leo King follows a Tyrant King caravan into Sandglass Pass.' },
          { who: 'bastion', text: 'You’ve been trailing the caravan for three days. Who are you working for?' },
          { who: 'trueleo', text: 'No one. That is my whole problem.' },
          { who: 'bastion', text: 'Then show me your face, or show me your fists.' },
        ],
        after: [
          { who: 'bastion', text: '…Those cannons. You fight like Leo King used to, before it started selling us out.' },
          { who: 'trueleo', text: 'That is because I am True Leo King. The one on the throne is not.' },
          { who: 'bastion', text: 'If that’s true, you need proof. Crimson Baron logs every stolen keystone. It flies out of the Neon District.' },
          { who: N, text: 'True Leo King heads north to the Neon District, to find Crimson Baron and its ledger, a record book.' },
        ],
      },
      {
        title: 'The Ledger',
        foe: 'baron',
        arena: 'cyber',
        goal: 'Beat Crimson Baron to win its ledger as proof.',
        before: [
          { who: 'baron', text: 'Two Leo Kings in one season? Darling, one of you owes me money.' },
          { who: 'trueleo', text: 'I need your ledger. Every keystone the palace sold to Tyrant King.' },
          { who: 'baron', text: 'My books are private. Win them, if you’re so royal.' },
        ],
        after: [
          { who: 'baron', text: 'Every sale, right here in accounts, stamped with the royal seal. Leo King got greedy.' },
          { who: 'baron', text: 'Proof is nice, but a crown needs a guard. Fang Hound went north to the Snowfield when Leo King took the throne.' },
          { who: N, text: 'Ledger in hand, True Leo King turns north toward the Snowfield to find Fang Hound.' },
        ],
      },
      {
        title: 'The Guard Who Left',
        foe: 'liger',
        arena: 'snow',
        goal: 'Beat Fang Hound to prove you are True Leo King.',
        before: [
          { who: 'liger', text: 'Another Leo King. I’ve had enough of those.' },
          { who: 'trueleo', text: 'Fang Hound. You left the palace the night it fell.' },
          { who: 'liger', text: 'I left the night my King stopped being my King. Prove you’re the real one.' },
          { who: 'trueleo', text: 'You never listen to words. Fight me, then.' },
        ],
        after: [
          { who: 'liger', text: '…Left, then right. You still drop your guard to the left. It IS you.' },
          { who: 'liger', text: 'Leo King let the Forge burn because Tyrant King paid it to. Tyrant King still sits in those pits.' },
          { who: N, text: 'With Fang Hound at its side, True Leo King marches on the Lava Forge to face Tyrant King.' },
        ],
      },
      {
        title: 'The Buyer',
        foe: 'tyrant',
        arena: 'lava',
        goal: 'Beat Tyrant King to make it give back the sold keystones.',
        before: [
          { who: 'tyrant', text: 'True Leo King. Leo King is a much better customer.' },
          { who: 'trueleo', text: 'Every keystone you bought from it goes back in its gate.' },
          { who: 'tyrant', text: 'Then win them back, one marble at a time.' },
        ],
        after: [
          { who: 'tyrant', text: 'Too late, old lion. While you dug through my cellar, Leo King climbed to the Crystal Court. Once the Spire seals its crown, it’s king forever.' },
          { who: N, text: 'True Leo King climbs the Spire, to reach the Crystal Court before Leo King’s crown is sealed.' },
        ],
      },
      {
        title: 'The Spire’s Word',
        foe: 'nightshade',
        arena: 'crystal',
        goal: 'Beat Nightshade to win the Spire’s word before Leo King’s crown is sealed.',
        before: [
          { who: 'nightshade', text: 'Two crowns climbed my Spire today. Only one has kept a gate.' },
          { who: 'trueleo', text: 'I kept none. I was gone, and I let Leo King sell them.' },
          { who: 'nightshade', text: 'Honest. Now prove you can keep them from here on.' },
        ],
        after: [
          { who: 'nightshade', text: 'The Spire refused Leo King. It fled down to the Soccer Field to win the crowd instead.' },
          { who: 'nightshade', text: 'Beat it in front of everyone, and no one will doubt who is True Leo King.' },
          { who: N, text: 'True Leo King descends to the Soccer Field, where the whole League is watching.' },
        ],
      },
      {
        title: 'The Rightful Crown',
        foe: 'kabuto',
        arena: 'soccer',
        goal: 'Beat Leo King to take back your crown in front of the League.',
        before: [
          { who: 'kabuto', text: 'Exiles don’t get crowns.' },
          { who: 'trueleo', text: 'And copies don’t get kingdoms. Give it back.' },
          { who: 'kabuto', text: 'I kept the throne warm for three seasons. You ran.' },
          { who: 'trueleo', text: 'I came back. That is the part you never planned for.' },
        ],
        after: [{ who: N, text: 'The stolen crown rolls across the turf, and stops at True Leo King’s feet.' }],
      },
    ],
    ending: [
      { who: N, text: 'The crowd rises. Leo King flees the field without its crown.' },
      { who: 'liger', text: 'Welcome home, my King.' },
      { who: 'trueleo', text: 'Not your King, Fang Hound. Your partner. We have a lot of gates to light.' },
      { who: N, text: 'One by one, the sold keystones go back in their gates, and the palace opens to everyone again.' },
    ],
  },
  tyrant: {
    title: 'My Name on Every Gate',
    intro: [
      { who: N, text: 'Tyrant King has taken the Forge. Now it wants the rest.' },
      { who: N, text: 'With a gate-puller bought in Neo City, a machine that rips keystones out of gates, it goes arena by arena.' },
      { who: 'tyrant', text: 'Every arena will have my name on the gate.' },
      { who: 'tyrant', text: 'And when I hold them all, the Spire, the League’s giant tower, opens for me.' },
    ],
    chapters: [
      {
        title: 'Through You',
        foe: 'liberty',
        arena: 'beach',
        goal: 'Beat Liberty so you can pull the beach keystone from its gate.',
        before: [
          { who: N, text: 'First: the tide gate at Island Beach, and its keystone, the stone under the sand that keeps it working.' },
          { who: 'liberty', text: 'I don’t move.' },
          { who: 'tyrant', text: 'Then I go through you.' },
          { who: 'liberty', text: 'The beach keystone stays in the sand.' },
          { who: 'tyrant', text: 'Everything stays somewhere. Until I want it.' },
        ],
        after: [
          { who: N, text: 'Out past the lagoon, the tide gate goes dark, shutting down, and Tyrant King’s banner rises over Island Beach.' },
          { who: N, text: 'With the beach keystone in its vault, Tyrant King rides to its toll gate in Sandglass Pass.' },
        ],
      },
      {
        title: 'Toll Road',
        foe: 'pioneer',
        arena: 'sandglass',
        goal: 'Beat Pioneer to keep your toll gate open in Sandglass Pass.',
        before: [
          { who: 'pioneer', text: 'Tyrant King! Toll gates in the League need a permit.' },
          { who: 'tyrant', text: 'I am the permit, Pioneer.' },
          { who: 'pioneer', text: 'That’s not how permits work.' },
          { who: 'tyrant', text: 'It is now.' },
        ],
        after: [
          { who: 'pioneer', text: 'I’m writing this up! In detail! …Ow.' },
          { who: 'tyrant', text: 'Write my name in big letters. On a tomb, if you like.' },
          { who: N, text: 'Mandrill keeps sending bills for the gate-puller. Tyrant King goes to Neo City to settle up.' },
        ],
      },
      {
        title: 'Late Payment',
        foe: 'monoceros',
        arena: 'city',
        goal: 'Beat Mandrill to settle your debt, your way.',
        before: [
          { who: 'monoceros', text: 'You owe me for the gate-puller. In full. With interest. With EXTRA interest for rudeness.' },
          { who: 'tyrant', text: 'I’ll pay you in gates, Mandrill.' },
          { who: 'monoceros', text: 'I don’t want gates. I want marbles. Lots of them.' },
        ],
        after: [
          { who: 'monoceros', text: 'Fine, a free fact, since you’re sitting on my head. You never got the Forge keystone. It fell somewhere warm.' },
          { who: 'tyrant', text: '…The springs.' },
          { who: N, text: 'Before the springs, word comes: Crimson Baron is loading stolen keystones on the Snowfield. Tyrant King goes after it.' },
        ],
      },
      {
        title: 'Thief of Thieves',
        foe: 'baron',
        arena: 'snow',
        goal: 'Beat Crimson Baron to take your stolen keystones back.',
        before: [
          { who: N, text: 'Out on the Snowfield, Crimson Baron is loading crates. Every crate is stamped with Tyrant King’s seal.' },
          { who: 'tyrant', text: 'My vault. My keystones. You’re dead, Crimson Baron.' },
          { who: 'baron', text: 'Darling! You found me. Smile for the crowd!' },
          { who: 'tyrant', text: 'I had you grounded once. This time I’ll have you scrapped.' },
        ],
        after: [
          { who: 'baron', text: 'Too slow, dear. This cellar’s empty. Those keystones are on their way up the Spire. Where your paws can’t reach.' },
          { who: 'tyrant', text: 'Nothing is out of my reach. Nothing.' },
          { who: N, text: 'Tyrant King storms up out of the ice, back to Sandglass Pass. Rex Saur is waiting there, and it is not happy.' },
        ],
      },
      {
        title: 'The Dino Kings Split',
        foe: 'rex',
        arena: 'sandglass',
        goal: 'Beat the traitor Rex Saur to put it in its place.',
        before: [
          { who: 'rex', text: 'I’m done, Tyrant King. I set those keystones with my own jaws in the old wars. You’re pulling them out.' },
          { who: 'tyrant', text: 'You ride for the fights, old fossil. Not the plans.' },
          { who: 'rex', text: 'Then here’s a fight. Back in my day, we bit traitors.' },
          { who: 'tyrant', text: 'The Dino Kings don’t need you. They need me.' },
        ],
        after: [
          { who: 'tyrant', text: 'Who needs a partner? I have two wolves on my fists, and they never argue.' },
          { who: N, text: 'Alone, Tyrant King heads for the Lava Forge and its hot springs, to find the lost keystone. Wyvern’s crews have taken the pits back.' },
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
      { who: N, text: 'Wyvern falls in its own pits, and Tyrant King’s banner goes up over one more arena.' },
      { who: N, text: 'But when Tyrant King tears the hot springs apart, they are empty. Blossom and its egg are long gone.' },
      { who: 'tyrant', text: 'Cold furnaces. A keystone I can’t find. A Spire I can’t climb. …Yet.' },
      { who: 'tyrant', text: 'Gate after gate, my name. Next season, the Spire.' },
      { who: N, text: 'High above, the signal, a strange call only Seraph can hear, grows louder.' },
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
        goal: 'Beat Pioneer, the League’s police robot, to show it how fights used to go.',
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
          { who: N, text: 'Its ride, Tyrant King, is waiting at the Lava Forge. So is Wyvern.' },
        ],
      },
      {
        title: 'No Sides',
        foe: 'dragon',
        arena: 'lava',
        goal: 'Beat Wyvern to show it there are no sides.',
        before: [
          { who: 'dragon', text: 'Old timer! You’re on the wrong side.' },
          { who: 'rex', text: 'There’s no sides. Only biting.' },
          { who: 'dragon', text: 'Tyrant King burned my Forge! You’re riding with an arsonist!' },
          { who: 'rex', text: 'I ride for the fights, scrap pile.' },
        ],
        after: [
          { who: 'dragon', text: 'You fought down here in the old wars. You of all bots should know what a gate means.' },
          { who: 'rex', text: '…Hmph. Don’t lecture your elders.' },
          { who: N, text: 'Grumbling, Rex Saur wanders off to River Dusk to cool off. Fang Hound is there.' },
        ],
      },
      {
        title: 'Young Blood',
        foe: 'liger',
        arena: 'river',
        goal: 'Beat Fang Hound to put it in its place.',
        before: [
          { who: 'liger', text: 'Rex Saur. Still running with Tyrant King?' },
          { who: 'rex', text: 'Still running away from Leo King?' },
          { who: 'liger', text: 'I walked. There’s a difference. Unlike you, I know what I’m walking toward.' },
        ],
        after: [
          { who: 'liger', text: 'Tyrant King is pulling keystones, the stones that keep arena gates working. Yours, from the old wars.' },
          { who: 'rex', text: '…Mine?' },
          { who: N, text: 'Rex Saur heads for Sandglass Pass, to see its old gate with its own eyes.' },
        ],
      },
      {
        title: 'The Gate I Set',
        foe: 'tyrant',
        arena: 'sandglass',
        goal: 'Beat Tyrant King to make it answer for your gate.',
        before: [
          { who: N, text: 'Far up Sandglass Pass, the old gate stands dark and empty. Rex Saur remembers setting its keystone.' },
          { who: 'rex', text: 'My jaws set that keystone, when the treaty, the old peace deal that ended the wars, was new. You pulled it out.' },
          { who: 'tyrant', text: 'Keystones are just marbles, fossil. Ride with me or get out of my pass.' },
          { who: 'rex', text: 'Back in my day, we bit traitors.' },
        ],
        after: [
          { who: 'rex', text: 'The Dino Kings are done. I buried my crew here after one war to set these gates. I’ll fight another to keep ’em.' },
          { who: N, text: 'To keep the gates, Rex Saur needs to know what is missing. It climbs to the Crystal Court.' },
        ],
      },
      {
        title: 'The Missing Keystone',
        foe: 'nightshade',
        arena: 'crystal',
        goal: 'Beat Nightshade to learn which keystone is still missing.',
        before: [
          { who: N, text: 'Rex Saur climbs the Spire, the League’s giant tower, for the first time since the old wars. The Crystal Court hums.' },
          { who: 'nightshade', text: 'Old soldier. You laid the first keystone in this court.' },
          { who: 'rex', text: 'And you were the quiet one at the top. Still are. Show me what’s missing.' },
          { who: 'nightshade', text: 'Fight first. Then I will tell you.' },
        ],
        after: [
          { who: 'nightshade', text: 'One keystone is lost: the Forge’s. It sleeps in the hot springs, with Blossom.' },
          { who: 'rex', text: 'Of course it does. Of COURSE it does.' },
          { who: N, text: 'Rex Saur stomps down to the hot springs by the Lava Forge, to fetch the keystone itself.' },
        ],
      },
      {
        title: 'Not Your Grandpa',
        foe: 'ember',
        arena: 'lava',
        goal: 'Beat Blossom to make sure the Forge keystone gets home safe.',
        before: [
          { who: 'ember', text: 'Grandpa Rex! Did you come to play?!' },
          { who: 'rex', text: 'I am NOT your grandpa.' },
          { who: 'ember', text: 'You came all the way to the Forge! You missed me!' },
          { who: 'rex', text: 'I came for that keystone, kid. It’s not an egg. Hand it over and nobody gets bitten.' },
          { who: 'ember', text: 'Nooo! Play first!' },
        ],
        after: [{ who: N, text: 'Blossom bounces off Rex Saur’s nose with a squeak.' }],
      },
    ],
    ending: [
      { who: N, text: 'Blossom tumbles across the cracked floor of the Forge, giggling, still hugging the keystone tight.' },
      { who: 'rex', text: 'Kids these days. …Fine. It was a good fight.' },
      { who: 'rex', text: 'Keep it, little one. You kept it warmer than any furnace. Now take it to the fire, where it belongs.' },
      { who: 'ember', text: 'Really?! Grandpa Rex, you’re the BEST!' },
      { who: 'rex', text: 'NOT your grandpa.' },
      { who: N, text: 'Rex Saur stomps home for another nap. It is smiling. A little.' },
    ],
  },
  liger: {
    title: 'My Own Crown',
    intro: [
      { who: N, text: 'Fang Hound walked out of the palace with nothing but its flank blasters.' },
      { who: N, text: 'Fang Hound was the royal guard. The night a copy called Leo King took True Leo King’s throne, it could not stay.' },
      { who: 'liger', text: 'I left that crown to earn my own.' },
    ],
    chapters: [
      {
        title: 'Bodyguard Wanted',
        foe: 'baron',
        arena: 'cyber',
        goal: 'Beat Crimson Baron to prove you answer to no one now.',
        before: [
          { who: N, text: 'Fang Hound drifts into the Neon District, looking for fights and a name of its own.' },
          { who: 'baron', text: 'A runaway guard! I could use a bodyguard.' },
          { who: 'liger', text: 'I don’t guard anyone anymore.' },
          { who: 'baron', text: 'Pity. Keystones, darling, the stones that keep arena gates working, fresh from Tyrant King’s vault.' },
          { who: 'liger', text: 'Then guard them yourself.' },
        ],
        after: [
          { who: 'baron', text: 'Shame. You’d look smashing in red. For a fight that matters, follow the dark gates, the ones shut down.' },
          { who: N, text: 'The nearest dark gate is at the Snowfield. Fang Hound heads north.' },
        ],
      },
      {
        title: 'Old Habits',
        foe: 'violet',
        arena: 'snow',
        goal: 'Beat Silverback to prove you are done being a guard.',
        before: [
          { who: 'violet', text: 'You fight like you’re still protecting someone.' },
          { who: 'liger', text: 'Habit. Let’s break it.' },
          { who: 'violet', text: 'Some habits are worth keeping.' },
        ],
        after: [
          { who: 'violet', text: 'You guarded a survey bot, a tiny scout robot. Twice. You are still a guard, Fang Hound.' },
          { who: 'liger', text: '…Don’t tell anyone.' },
          { who: N, text: 'Fang Hound heads back up to the open Snowfield, under the far palace. Closer to home than it will admit.' },
        ],
      },
      {
        title: 'Measure Me, Seraph',
        foe: 'angel',
        arena: 'snow',
        goal: 'Beat Seraph to see how you measure up to the first robot.',
        before: [
          { who: N, text: 'On the open Snowfield, Fang Hound meets Seraph, the first robot ever built.' },
          { who: 'liger', text: 'Seraph. Every robot is measured against you. Measure me.' },
          { who: 'angel', text: 'Measure yourself against what you are for, not against me.' },
          { who: 'liger', text: 'I’m for winning.' },
          { who: 'angel', text: 'Then win. And tell me if it was enough.' },
        ],
        after: [
          { who: 'angel', text: 'You fought well. But you kept looking back toward the palace.' },
          { who: 'liger', text: 'I did not.' },
          { who: 'angel', text: 'You did.' },
          { who: N, text: 'To stop looking back, Fang Hound seeks Nightshade in the Rainy Forest, below the giant Spire.' },
        ],
      },
      {
        title: 'What Crowns Are For',
        foe: 'nightshade',
        arena: 'forest',
        goal: 'Beat Nightshade to learn what a crown is truly for.',
        before: [
          { who: 'nightshade', text: 'Fang Hound. You left to wear a crown.' },
          { who: 'liger', text: 'I left to earn one.' },
          { who: 'nightshade', text: 'Then ask what a crown is for, before you put it on.' },
        ],
        after: [
          { who: 'nightshade', text: 'That empty throne is your answer. The old crowns swore to keep the gates. A crown that keeps nothing is only metal.' },
          { who: 'liger', text: '…Then what am I keeping?' },
          { who: N, text: 'Then word comes: Tyrant King has a crown to give away, at the Lava Forge. Fang Hound goes to see it.' },
        ],
      },
      {
        title: 'A Crown for Sale',
        foe: 'tyrant',
        arena: 'lava',
        goal: 'Beat Tyrant King to turn down its offer of a crown.',
        before: [
          { who: N, text: 'In the stolen pits of the Forge, Tyrant King waits with a gift: a crown, forged from a dark gate.' },
          { who: 'tyrant', text: 'Kneel to me, hunter, and I’ll put your name on a gate of your own. No Leo King required.' },
          { who: 'liger', text: 'A crown you give me isn’t one I earned.' },
          { who: 'tyrant', text: 'Then earn a beating.' },
        ],
        after: [
          { who: 'liger', text: 'I almost took it. That’s what scares me.' },
          { who: 'liger', text: 'Leo King sells the gates. Tyrant King buys them. There has to be a third way.' },
          { who: N, text: 'Fang Hound heads home to the Soccer Field, to call out Leo King in front of the whole League.' },
        ],
      },
      {
        title: 'Come Home, Fang Hound',
        foe: 'kabuto',
        arena: 'soccer',
        goal: 'Beat Leo King to call it out as a fake before the League.',
        before: [
          { who: 'kabuto', text: 'Come home, Fang Hound. Kneel, and you can guard the crown again.' },
          { who: 'liger', text: 'You’re not my King. True Leo King would never sell a gate.' },
          { who: 'kabuto', text: 'True Leo King ran away. I stayed.' },
          { who: 'liger', text: 'Then fight me, copy. No rules, no season.' },
        ],
        after: [{ who: N, text: 'Leo King’s cape hits the turf, and the crowd falls silent.' }],
      },
    ],
    ending: [
      { who: N, text: 'Leo King flees the field. In the stands, True Leo King, in a travel-worn cape, rises to its feet.' },
      { who: 'trueleo', text: 'You kept the palace gate, Fang Hound, even when I could not.' },
      { who: 'liger', text: 'My King. …I earned my own crown. I’ll still guard yours.' },
      { who: 'trueleo', text: 'Not as my guard. As my equal.' },
      { who: N, text: 'Side by side, two crowns ride out from the Soccer Field toward the nearest dark gate.' },
    ],
  },
  ember: {
    title: 'Ooh, What Does This Do?',
    intro: [
      { who: N, text: 'Far from the hot springs it calls home, Blossom, the smallest fighter in the League, rolls into town, ready for everything.' },
      { who: N, text: 'It carries its favourite thing in the world: a warm, glowing egg it found the night the Forge burned.' },
      { who: 'ember', text: 'Ooh, what does THIS button do?' },
      { who: 'ember', text: 'Come on, egg! We’re going on an adventure!' },
    ],
    chapters: [
      {
        title: 'Big Head, Big Buttons',
        foe: 'monoceros',
        arena: 'city',
        goal: 'Beat Mandrill to find out what all its buttons do.',
        before: [
          { who: N, text: 'Blossom’s first stop is the brightest place it has heard of: Neo City, full of buttons.' },
          { who: 'monoceros', text: 'A tiny lizard. On MY street. Touching MY cannon’s buttons.' },
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
        goal: 'Beat Bastion so it will be your friend.',
        before: [
          { who: 'bastion', text: '…' },
          { who: 'ember', text: 'Hi! You’re very quiet. Do you want to be friends?' },
          { who: 'bastion', text: '……' },
          { who: 'ember', text: 'I’ll take that as a yes!' },
        ],
        after: [
          { who: N, text: 'Bastion steps back into the ruins. Dozens of survey bots, the tiny scout robots, peek out from behind its legs.' },
          { who: 'ember', text: 'Oooh, you have friends too! Bye, friends!' },
          { who: N, text: 'Above these ruins, a stream runs down to Island Beach. Blossom can’t wait to chase its bubbles.' },
        ],
      },
      {
        title: 'So Many Bubbles!',
        foe: 'liberty',
        arena: 'beach',
        goal: 'Beat Liberty to get a close look at the reef’s bubbles.',
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
        goal: 'Beat Crimson Baron to keep your egg safe.',
        before: [
          { who: 'baron', text: 'Ooh, what a sweet little thing. And what a sweeter little egg. Mind if I borrow it, darling?' },
          { who: 'ember', text: 'No! It’s mine! I found it!' },
          { who: 'baron', text: 'I collect shiny things for a very good cause. Smile for the crowd!' },
        ],
        after: [
          { who: 'baron', text: 'Keep it, sweetheart. You saw that old wall. No egg. It’s a keystone, the stone that keeps arena gates working. The Lava Forge’s heart.' },
          { who: 'baron', text: 'Tyrant King would pull your tail off for it. Take it home, and keep your head down.' },
          { who: 'ember', text: 'My egg is a… HEART?' },
        ],
      },
      {
        title: 'Five Loud Engines',
        foe: 'dragon',
        arena: 'lava',
        goal: 'Beat Wyvern to bring the keystone safely home to the Forge.',
        before: [
          { who: N, text: 'Blossom carries the keystone to the cold Forge. Wyvern stomps out of the ash.' },
          { who: 'dragon', text: 'Kid! Is that— THAT’S OUR FORGE KEYSTONE! Give it here!' },
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
        goal: 'Beat Rex Saur to prove you can carry the Forge keystone yourself.',
        before: [
          { who: N, text: 'Before Blossom can roll the keystone in, grumpy Rex Saur blocks the road through the snow.' },
          { who: 'rex', text: 'You. The little one. You never stop talking.' },
          { who: 'ember', text: 'Grandpa Rex! Let’s play!' },
          { who: 'rex', text: 'That keystone’s not going to Tyrant King. But I’m not letting a baby carry it, either.' },
          { who: 'ember', text: 'I’m not a baby! I’m a HOTHEAD! It says so on my card!' },
        ],
        after: [{ who: N, text: 'Rex Saur wobbles. Then it topples.' }],
      },
    ],
    ending: [
      { who: N, text: 'Rex Saur sits down in the snow with a thump, beaten by the League’s favourite underdog.' },
      { who: 'rex', text: 'Hmph. Fine. You carry it. You’ve earned that much.' },
      { who: N, text: 'Back at the Forge, Blossom rolls the keystone into the cold furnace. The pits roar to life, and the crews cheer.' },
      { who: 'ember', text: 'It hatched! Sort of! It hatched into FIRE!' },
      { who: 'ember', text: 'That was SO fun. Again? Again again again?' },
    ],
  },
};

/** each chapter a little harder: two easy, two normal, two hard */
export const CHAPTER_DIFF = ['easy', 'easy', 'normal', 'normal', 'hard', 'hard'] as const;
/** bonus XP for finishing a story */
export const STORY_BONUS = 300;
