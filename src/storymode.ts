/**
 * Story mode: every fighter has its own three-chapter path through the Marble League, ending
 * against its rival. Each chapter is a talk before the fight (the opponent, then your reply),
 * the fight itself on the opponent's home turf, and an ending once the last one falls.
 * `who` is a fighter's base id, or 'narrator'.
 */
export interface Line {
  who: string;
  text: string;
}
export interface Chapter {
  foe: string;
  arena: string;
  before: Line[];
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
      { who: N, text: 'A signal pulses from the top of the Spire, and only Seraph Zero can hear it.' },
      { who: 'angel', text: 'Every frame since was measured against me. Now I want to know why.' },
    ],
    chapters: [
      { foe: 'pioneer', arena: 'city', before: [{ who: 'pioneer', text: 'Orbital unit! You’re heading for the Spire without a licence. Pull over!' }, { who: 'angel', text: 'Then write me a ticket, marshal. After the fight.' }] },
      { foe: 'violet', arena: 'snow', before: [{ who: 'violet', text: 'The Spire eats little machines. Stand behind me, or get past me.' }, { who: 'angel', text: 'I was built to stand in front, not behind.' }] },
      { foe: 'nightshade', arena: 'cyber', before: [{ who: 'nightshade', text: 'You climbed all this way to meet yourself.' }, { who: 'angel', text: 'Then show me what I forgot.' }] },
    ],
    ending: [
      { who: N, text: 'Nightshade’s tail flickers out. “Sibling,” it whispers, “now you remember.”' },
      { who: 'angel', text: 'I was the first, so that no one after me would have to be what you became. I’ll carry that.' },
    ],
  },
  dragon: {
    title: 'Five Engines, One Grudge',
    intro: [
      { who: N, text: 'The Lava Forge is cold ash, and Tyrant King’s banner hangs over the pits.' },
      { who: 'dragon', text: 'The crews built me out of scrap. I’ll win them their name back.' },
    ],
    chapters: [
      { foe: 'ember', arena: 'lava', before: [{ who: 'ember', text: 'Ooh, are you the big one from the Forge? Can I see your sword? Can I fight you?!' }, { who: 'dragon', text: 'Sure, kid. Warm-up round.' }] },
      { foe: 'rex', arena: 'snow', before: [{ who: 'rex', text: 'Tyrant pays me to stop you. Back in my day we did it for free.' }, { who: 'dragon', text: 'Then you’re overpaid, old timer.' }] },
      { foe: 'tyrant', arena: 'lava', before: [{ who: 'tyrant', text: 'Every arena will have my name on the gate. Even this burnt-out pit.' }, { who: 'dragon', text: 'This pit built me. Five engines, one grudge.' }] },
    ],
    ending: [
      { who: N, text: 'The forges roar back to life, and the pit crews paint a new name over the gate: WYVERN.' },
      { who: 'dragon', text: 'Light ’em up. We’re open again.' },
    ],
  },
  pioneer: {
    title: 'The Long Chase',
    intro: [
      { who: N, text: 'Rare marbles are vanishing between arenas, and every lead points to a crimson flying ace.' },
      { who: 'pioneer', text: 'Marshal Pioneer, on patrol. Nobody smuggles on my rail.' },
    ],
    chapters: [
      { foe: 'liger', arena: 'river', before: [{ who: 'liger', text: 'I don’t answer to the King, and I don’t answer to cops.' }, { who: 'pioneer', text: 'You’ll answer to the rail, then. License and marbles, please.' }] },
      { foe: 'monoceros', arena: 'city', before: [{ who: 'monoceros', text: 'The Baron? I sold the Baron the route maps. I am a genius, not a criminal.' }, { who: 'pioneer', text: 'You can be both. Hands where I can see them. Er, cannons.' }] },
      { foe: 'baron', arena: 'cyber', before: [{ who: 'baron', text: 'Smile for the crowd, marshal! It’s the last thing they’ll see you do.' }, { who: 'pioneer', text: 'Crimson Baron, you’re under arrest. Finally.' }] },
    ],
    ending: [
      { who: N, text: 'The crowd cheers as the Baron is towed off the rail, still waving.' },
      { who: 'pioneer', text: 'Case closed. …Until the next one.' },
    ],
  },
  liberty: {
    title: 'Hold the Line',
    intro: [
      { who: N, text: 'Something is stirring under Island Beach: an old lab, and an older grudge.' },
      { who: 'liberty', text: 'I don’t move. Whatever is coming has to come through me.' },
    ],
    chapters: [
      { foe: 'baron', arena: 'beach', before: [{ who: 'baron', text: 'Lovely beach. Shame if someone landed a cargo of marbles on it.' }, { who: 'liberty', text: 'Not on my sand.' }] },
      { foe: 'bastion', arena: 'forest', before: [{ who: 'bastion', text: '…' }, { who: 'liberty', text: 'You’re the one clearing the path for it. I can tell.' }] },
      { foe: 'monoceros', arena: 'city', before: [{ who: 'monoceros', text: 'You SANK my lab. I have been planning this for nine hundred and twelve days.' }, { who: 'liberty', text: 'Then you know how it ends.' }] },
    ],
    ending: [
      { who: N, text: 'Mandrill’s cannons fall silent. The line holds, as it always does.' },
      { who: 'liberty', text: 'Back to the beach. Someone has to stand guard.' },
    ],
  },
  monoceros: {
    title: 'The Grand Plan',
    intro: [
      { who: N, text: 'In a hidden lab under Neo City, a very large head is laughing.' },
      { who: 'monoceros', text: 'Step one: humiliate. Step two: humiliate more. Step three: Liberty.' },
    ],
    chapters: [
      { foe: 'pioneer', arena: 'city', before: [{ who: 'pioneer', text: 'Mandrill, you’re wanted for questioning.' }, { who: 'monoceros', text: 'Question THIS.' }] },
      { foe: 'ember', arena: 'lava', before: [{ who: 'ember', text: 'Your head is SO big. Is it heavy? Can I climb it?' }, { who: 'monoceros', text: 'Absolutely not. Prepare to be out-thought.' }] },
      { foe: 'liberty', arena: 'beach', before: [{ who: 'liberty', text: 'I don’t move. You do.' }, { who: 'monoceros', text: 'Not this time, tin diver. I brought the math.' }] },
    ],
    ending: [
      { who: N, text: 'Liberty’s treads finally roll backwards, one slow metre into the sea.' },
      { who: 'monoceros', text: 'Write it down! Write it ALL down! I am, as predicted, the smartest thing on any rail.' },
    ],
  },
  baron: {
    title: 'One Last Delivery',
    intro: [
      { who: N, text: 'One rare golden marble, three arenas, and a marshal on its tail.' },
      { who: 'baron', text: 'One last delivery, darling. Then I retire. Probably.' },
    ],
    chapters: [
      { foe: 'liberty', arena: 'beach', before: [{ who: 'liberty', text: 'Not on my sand.' }, { who: 'baron', text: 'Then I’ll fly over it. Smile!' }] },
      { foe: 'kabuto', arena: 'river', before: [{ who: 'kabuto', text: 'That golden marble belongs to the crown.' }, { who: 'baron', text: 'Finders keepers, your majesty.' }] },
      { foe: 'pioneer', arena: 'city', before: [{ who: 'pioneer', text: 'End of the line, Baron. This time I’ve got you.' }, { who: 'baron', text: 'Marshal! I was hoping you’d come. The crowd loves you.' }] },
    ],
    ending: [
      { who: N, text: 'The golden marble lands in the buyer’s hands, and the Baron is already gone.' },
      { who: 'baron', text: 'Retirement can wait. The crowd can’t.' },
    ],
  },
  bastion: {
    title: 'The Hunt',
    intro: [
      { who: N, text: 'Deep in the Rainy Forest, two scythes open in the dark.' },
      { who: 'bastion', text: '…' },
    ],
    chapters: [
      { foe: 'ember', arena: 'forest', before: [{ who: 'ember', text: 'Hello? Is someone there? I heard clicking.' }, { who: 'bastion', text: '…' }] },
      { foe: 'liger', arena: 'river', before: [{ who: 'liger', text: 'I can smell you, bug. Come out and face me.' }, { who: 'bastion', text: '…' }] },
      { foe: 'violet', arena: 'snow', before: [{ who: 'violet', text: 'You’ve hunted enough little ones. Stand behind me, all of you.' }, { who: 'bastion', text: '……' }] },
    ],
    ending: [
      { who: N, text: 'The silverback falls to one knee. For the first time, the forest is silent because of Bastion, not around it.' },
      { who: 'bastion', text: '…satisfied.' },
    ],
  },
  nightshade: {
    title: 'Waiting at the Top',
    intro: [
      { who: N, text: 'At the top of the Spire, a hooded frame drifts above its single tail.' },
      { who: 'nightshade', text: 'My sibling is climbing. Let us make sure it is ready.' },
    ],
    chapters: [
      { foe: 'liger', arena: 'river', before: [{ who: 'liger', text: 'Ghost. They say you’re unbeatable. I say prove it.' }, { who: 'nightshade', text: 'Proof is cheap. Watch.' }] },
      { foe: 'kabuto', arena: 'soccer', before: [{ who: 'kabuto', text: 'Even ghosts kneel to the crown.' }, { who: 'nightshade', text: 'Crowns are only metal.' }] },
      { foe: 'angel', arena: 'space', before: [{ who: 'angel', text: 'Every frame since was measured against me.' }, { who: 'nightshade', text: 'And I was the one they hid. Let us measure, sibling.' }] },
    ],
    ending: [
      { who: N, text: 'Seraph Zero kneels on the Orbital Deck, and Nightshade lowers its staff.' },
      { who: 'nightshade', text: 'Not today. Rise, and climb again. I will be waiting.' },
    ],
  },
  violet: {
    title: 'Stand Behind Me',
    intro: [
      { who: N, text: 'The little survey bots of Snowfield have stopped coming home.' },
      { who: 'violet', text: 'Someone is hunting the small ones. Stand behind me.' },
    ],
    chapters: [
      { foe: 'rex', arena: 'snow', before: [{ who: 'rex', text: 'Shiny little bots. Back in my day they were a snack.' }, { who: 'violet', text: 'Back in your day is over.' }] },
      { foe: 'tyrant', arena: 'lava', before: [{ who: 'tyrant', text: 'The bots? I sent them to the forest. Bastion was hungry.' }, { who: 'violet', text: 'Then you’re next. Left, right, left.' }] },
      { foe: 'bastion', arena: 'forest', before: [{ who: 'bastion', text: '…' }, { who: 'violet', text: 'Not one more.' }] },
    ],
    ending: [
      { who: N, text: 'One by one, the survey bots crawl out of the forest and gather around the silverback.' },
      { who: 'violet', text: 'Everyone home. Good.' },
    ],
  },
  kabuto: {
    title: 'A Crown Is Earned',
    intro: [
      { who: N, text: 'A new season of the League begins, and the King’s crown is on the line again.' },
      { who: 'kabuto', text: 'A crown is earned every season. Let them come.' },
    ],
    chapters: [
      { foe: 'baron', arena: 'cyber', before: [{ who: 'baron', text: 'Your majesty! I’ve brought you a gift. It’s stolen.' }, { who: 'kabuto', text: 'Then I will return it, after I return you.' }] },
      { foe: 'tyrant', arena: 'lava', before: [{ who: 'tyrant', text: 'One crown. One king. And it won’t be you.' }, { who: 'kabuto', text: 'Many have said so. None have kept it.' }] },
      { foe: 'liger', arena: 'river', before: [{ who: 'liger', text: 'I left the crown to earn my own.' }, { who: 'kabuto', text: 'Then earn it, Fang. I have waited for this.' }] },
    ],
    ending: [
      { who: N, text: 'The King offers a hand to its fallen guard, and this time Fang Liger takes it.' },
      { who: 'kabuto', text: 'Another season. Another crown. And an old friend at my side.' },
    ],
  },
  tyrant: {
    title: 'My Name on Every Gate',
    intro: [
      { who: N, text: 'Tyrant King has taken the Forge. Now it wants the rest.' },
      { who: 'tyrant', text: 'Every arena will have my name on the gate.' },
    ],
    chapters: [
      { foe: 'liberty', arena: 'beach', before: [{ who: 'liberty', text: 'I don’t move.' }, { who: 'tyrant', text: 'Then I go through you.' }] },
      { foe: 'kabuto', arena: 'soccer', before: [{ who: 'kabuto', text: 'A crown is earned, hellhound. Not taken.' }, { who: 'tyrant', text: 'Watch me take it.' }] },
      { foe: 'dragon', arena: 'lava', before: [{ who: 'dragon', text: 'Five engines, one grudge. You burned my home.' }, { who: 'tyrant', text: 'And I’ll burn it again.' }] },
    ],
    ending: [
      { who: N, text: 'Wyvern falls in its own pits, and the hellhound’s banner goes up over one more gate.' },
      { who: 'tyrant', text: 'Nine arenas. Nine gates. Next season, the Spire.' },
    ],
  },
  rex: {
    title: 'Back in My Day',
    intro: [
      { who: N, text: 'Rex Saur wakes up from a nap to find the League has gone soft. Again.' },
      { who: 'rex', text: 'Too shiny. Too fast. Too many buttons. Let’s fix that.' },
    ],
    chapters: [
      { foe: 'pioneer', arena: 'city', before: [{ who: 'pioneer', text: 'Sir, you can’t bite other fighters.' }, { who: 'rex', text: 'Watch me.' }] },
      { foe: 'dragon', arena: 'lava', before: [{ who: 'dragon', text: 'Old timer! You’re on the wrong side.' }, { who: 'rex', text: 'There’s no sides. Only biting.' }] },
      { foe: 'ember', arena: 'lava', before: [{ who: 'ember', text: 'Grandpa Rex! Did you come to play?!' }, { who: 'rex', text: 'I am NOT your grandpa.' }] },
    ],
    ending: [
      { who: N, text: 'Blossom tumbles into the hot springs, giggling, and Rex Saur stomps home for another nap.' },
      { who: 'rex', text: 'Kids these days. …Fine. It was a good fight.' },
    ],
  },
  liger: {
    title: 'My Own Crown',
    intro: [
      { who: N, text: 'Fang Liger walked out of the palace with nothing but its flank blasters.' },
      { who: 'liger', text: 'I left the crown to earn my own.' },
    ],
    chapters: [
      { foe: 'baron', arena: 'cyber', before: [{ who: 'baron', text: 'A runaway guard! I could use a bodyguard.' }, { who: 'liger', text: 'I don’t guard anyone anymore.' }] },
      { foe: 'violet', arena: 'snow', before: [{ who: 'violet', text: 'You fight like you’re still protecting someone.' }, { who: 'liger', text: 'Habit. Let’s break it.' }] },
      { foe: 'kabuto', arena: 'soccer', before: [{ who: 'kabuto', text: 'Come home, Fang.' }, { who: 'liger', text: 'Not until I beat you, my King.' }] },
    ],
    ending: [
      { who: N, text: 'The King kneels, and laughs. Fang Liger stands taller than it ever did at the palace gate.' },
      { who: 'liger', text: 'My own crown. …I still respect you. Don’t tell anyone.' },
    ],
  },
  ember: {
    title: 'Ooh, What Does This Do?',
    intro: [
      { who: N, text: 'The smallest fighter in the League climbs out of the hot springs, ready for everything.' },
      { who: 'ember', text: 'Ooh, what does THIS button do?' },
    ],
    chapters: [
      { foe: 'monoceros', arena: 'city', before: [{ who: 'monoceros', text: 'A tiny lizard. In MY lab. Touching MY buttons.' }, { who: 'ember', text: 'This one is orange! Orange is the best one!' }] },
      { foe: 'bastion', arena: 'forest', before: [{ who: 'bastion', text: '…' }, { who: 'ember', text: 'Hi! You’re very quiet. Do you want to be friends?' }] },
      { foe: 'rex', arena: 'snow', before: [{ who: 'rex', text: 'You. The little one. You never stop talking.' }, { who: 'ember', text: 'Grandpa Rex! Let’s play!' }] },
    ],
    ending: [
      { who: N, text: 'Rex Saur sits down in the snow with a thump, beaten by the League’s favourite underdog.' },
      { who: 'ember', text: 'That was SO fun. Again? Again again again?' },
    ],
  },
};

/** each chapter a little harder than the one before */
export const CHAPTER_DIFF = ['easy', 'normal', 'hard'] as const;
/** bonus XP for finishing a story */
export const STORY_BONUS = 150;
