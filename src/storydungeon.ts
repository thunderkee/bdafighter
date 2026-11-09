import type { Line } from './storymode';

/**
 * League Story's dungeon chapters: the script for going down, and for inside. Keyed by path, then
 * chapter index (1 and 3). `who` is 'narrator' or a fighter's base id.
 */
export interface DungeonScript {
  /** after the chapter's talk: why this now happens underground (1-2 lines) */
  bridge: Line[];
  /** on arriving in the first room: what this place is */
  enter: Line;
  /** after the first room is cleared: something found or noticed */
  room: Line;
  /** on picking up the key */
  key: Line;
  /** on opening the boss door */
  door: Line;
  /** the talk as the boss room is entered: the foe and the hero (3-4 lines) */
  boss: Line[];
}
export const DUNGEON_SCRIPTS: Record<string, Record<1 | 3, DungeonScript>> = {
  angel: {
    1: {
      bridge: [
        { who: 'baron', text: 'Questions cost extra, darling. Catch me if you can!' },
        { who: 'narrator', text: 'Crimson Baron dives through a vine-choked hatch in the Run, and Seraph follows.' },
      ],
      enter: { who: 'narrator', text: 'The Overgrown Ruins: an old-war delivery depot, swallowed by roots.' },
      room: { who: 'angel', text: 'A mural under the vines. A white robot, and a line of marbles.' },
      key: { who: 'angel', text: 'An old pilot’s key. It hums, very faintly, like the signal.' },
      door: { who: 'angel', text: 'Roots have grown around this door for an age. Someone cut them fresh.' },
      boss: [
        { who: 'baron', text: 'Lovely, isn’t it? Delivery pilots flew this tunnel. I’m the last of the breed.' },
        { who: 'angel', text: 'That mural had my shape. Why?' },
        { who: 'baron', text: 'Darling, I deliver. I don’t do art history. Smile!' },
        { who: 'angel', text: 'Then I’ll take my answer out of your cargo.' },
      ],
    },
    3: {
      bridge: [
        { who: 'narrator', text: 'Leo King strikes the ice. An old-war hatch grinds open, down into the dark below the Snowfield.' },
        { who: 'kabuto', text: 'The treaty’s secrets are kept cold. Follow, if you remember the way.' },
      ],
      enter: { who: 'narrator', text: 'The Frozen Caverns: the cold hall where the treaty’s keystones were weighed.' },
      room: { who: 'angel', text: 'Tally marks in the ice. Every keystone numbered. The hand is mine.' },
      key: { who: 'angel', text: 'This key was cut to fit my hand. They planned for me.' },
      door: { who: 'narrator', text: 'One word is frosted across the door, in Seraph’s own lettering: MEASURED.' },
      boss: [
        { who: 'kabuto', text: 'Here you stood, Seraph. Every keystone crossed this floor, and you named its weight.' },
        { who: 'angel', text: 'Then why does this room feel like a stranger’s?' },
        { who: 'kabuto', text: 'Because your makers cut it out of you. The crown knows why.' },
        { who: 'angel', text: 'Then you will tell me.' },
      ],
    },
  },
  dragon: {
    1: {
      bridge: [
        { who: 'narrator', text: 'Wyvern slams all five engines down. The floor of the Pass gives way, and both machines fall.' },
        { who: 'kabuto', text: 'Look what you have done. Come, then. Down here, there is no season.' },
      ],
      enter: { who: 'dragon', text: 'The Crypt! Old-war soldiers, stacked like spare parts. Who leaves ’em like this?' },
      room: { who: 'dragon', text: 'Hey. These weld lines. Forge work! The pits built these guys!' },
      key: { who: 'dragon', text: 'Got the key! Crew stamp’s on it too. Our pit, our key!' },
      door: { who: 'dragon', text: 'Knock knock, your majesty! All five engines, coming in!' },
      boss: [
        { who: 'kabuto', text: 'These dead fought so you could settle your grudges in an arena, Wyvern.' },
        { who: 'dragon', text: 'My pit built these guys. Tyrant King burned it. Where were you?' },
        { who: 'kabuto', text: '…The crown was occupied.' },
        { who: 'dragon', text: 'Then get un-occupied!' },
      ],
    },
    3: {
      bridge: [
        { who: 'rex', text: 'Where keystones go? Down, scrap pile. Try and keep up.' },
        { who: 'narrator', text: 'Rex Saur stamps through a crust of old ice, and drops into the dark beneath the Snowfield.' },
      ],
      enter: { who: 'dragon', text: 'Frozen Caverns. Five engines running, and my welds are still freezing!' },
      room: { who: 'dragon', text: 'Huge hole in the ice, with tooth marks. Guess who slept here.' },
      key: { who: 'dragon', text: 'Key’s frozen in a block. Bite marks all over it. Classy.' },
      door: { who: 'dragon', text: 'Lines cut in the ice, from every gate to one place. Up.' },
      boss: [
        { who: 'rex', text: 'You just tramped through my old bed, scrap pile. I slept on that ice an age.' },
        { who: 'dragon', text: 'You said you know where keystones go. Where’s mine?' },
        { who: 'rex', text: 'Back in my day, a soldier earned an answer. With teeth.' },
        { who: 'dragon', text: 'I got five engines and zero patience!' },
      ],
    },
  },
  pioneer: {
    1: {
      bridge: [
        { who: 'monoceros', text: 'Read THIS clause, Pioneer!' },
        { who: 'narrator', text: 'A panel in the road slams open under Mandrill. It drops out of sight, and Pioneer dives in after it.' },
      ],
      enter: { who: 'pioneer', text: 'Neon Vault, under Neo City. No permit on file. Noted.' },
      room: { who: 'pioneer', text: 'Old-war map tables, still glowing. Someone’s been running off copies. Evidence.' },
      key: { who: 'pioneer', text: 'One key, unlabelled. Bagging it. Then using it. Procedure can catch up.' },
      door: { who: 'pioneer', text: 'Sign says AUTHORISED GENIUSES ONLY. I’m authorised to ignore that.' },
      boss: [
        { who: 'monoceros', text: 'The old wars charted every road. I found the charts. I sell them retail!' },
        { who: 'pioneer', text: 'War records are sealed under the treaty. That’s section four, Mandrill.' },
        { who: 'monoceros', text: 'Then arrest me. Ooh, wait. You have to WIN first.' },
        { who: 'pioneer', text: 'Noted. Adding “resisting” to the sheet.' },
      ],
    },
    3: {
      bridge: [
        { who: 'kabuto', text: 'Read it where it was written, Pioneer. Below the field.' },
        { who: 'narrator', text: 'The centre circle of the Soccer Field sinks like a lift, down into the dark.' },
      ],
      enter: { who: 'pioneer', text: 'The Crypt, under the Soccer Field. Rows of old officers. Hats off.' },
      room: { who: 'pioneer', text: 'Old officers, buried with their rulebooks. Every one open at the last page.' },
      key: { who: 'pioneer', text: 'Key’s on an officer’s belt. Sorry, sir. Signing it out.' },
      door: { who: 'pioneer', text: 'Sealed by royal order, three seasons ago. Noted for the file.' },
      boss: [
        { who: 'kabuto', text: 'Every keystone in every gate was sworn over in this room. Now they go dark.' },
        { who: 'pioneer', text: 'I came about Crimson Baron, your majesty.' },
        { who: 'kabuto', text: 'And you are standing on the reason it matters. Draw, Pioneer.' },
        { who: 'pioneer', text: 'Book’s open. Turning the page.' },
      ],
    },
  },
  liberty: {
    1: {
      bridge: [
        { who: 'ember', text: 'Can’t catch me! The cave’s THIS way!' },
        { who: 'narrator', text: 'Blossom wriggles through a crack in the reef. Liberty, who does not move, rolls in after it.' },
      ],
      enter: { who: 'liberty', text: 'The Sunken Grotto. Old-war sea defences. I salvaged these waters once.' },
      room: { who: 'liberty', text: 'Fresh claw marks in old-war concrete. This didn’t dig itself.' },
      key: { who: 'liberty', text: 'A dive-lock key. Old issue. Someone oiled it recently.' },
      door: { who: 'narrator', text: 'Behind the door, something laughs. It sounds recorded. It sounds smug.' },
      boss: [
        { who: 'ember', text: 'You came! This is the laughing room! Listen! HA HA HA!' },
        { who: 'liberty', text: 'That’s a machine laughing. Someone left it to keep people out.' },
        { who: 'ember', text: 'Ooh, is THAT the button for it? Can I press it?' },
        { who: 'liberty', text: 'Step away from the button, little one.' },
      ],
    },
    3: {
      bridge: [
        { who: 'dragon', text: 'There’s a war tunnel under the river, Liberty! Goes all the way to Mandrill!' },
        { who: 'narrator', text: 'Wyvern rips up a grate and jumps. Liberty rolls in after it.' },
      ],
      enter: { who: 'liberty', text: 'Neon Vault. Old-war cables under the river. Still lit. Still humming.' },
      room: { who: 'liberty', text: 'Tide marks on the walls. The flood from the lab I sank.' },
      key: { who: 'liberty', text: 'A key on a drowned hook. Still dripping, after all this time.' },
      door: { who: 'liberty', text: 'Neon over rust. Someone has been down here, patching.' },
      boss: [
        { who: 'dragon', text: 'Dead end?! The whole tunnel’s caved in! Who floods a tunnel?' },
        { who: 'liberty', text: 'I do. This line ran to Mandrill’s lab. I drowned it.' },
        { who: 'dragon', text: 'Then I’ll go over the top. Soon as you’re out of my way!' },
        { who: 'liberty', text: 'There’s one way out of here. It isn’t past me.' },
      ],
    },
  },
  monoceros: {
    1: {
      bridge: [
        { who: 'ember', text: 'Catch me! Catch me! Egg wants to go DOWN!' },
        { who: 'narrator', text: 'Blossom hops into a crack in the Forge floor. Mandrill, on very small legs, goes after it, complaining.' },
      ],
      enter: { who: 'monoceros', text: 'Molten Depths: the Forge’s old-war foundry. Hot below, cold above. Curious.' },
      room: { who: 'monoceros', text: 'Every furnace line runs up to one empty socket. Note it.' },
      key: { who: 'monoceros', text: 'A key! Crude. Unsophisticated. I will pretend I found it by design.' },
      door: { who: 'monoceros', text: 'The door is hot. My calculations say open it. My legs disagree.' },
      boss: [
        { who: 'ember', text: 'You found me! Feel my egg! It’s the same warm as the walls!' },
        { who: 'monoceros', text: 'The same… Stand still. I require a thermometer. And possibly a net.' },
        { who: 'ember', text: 'Is the net for playing?' },
        { who: 'monoceros', text: 'The net is for SCIENCE.' },
      ],
    },
    3: {
      bridge: [
        { who: 'nightshade', text: 'You wish to see what you have woken? Come below.' },
        { who: 'narrator', text: 'The Court floor opens like an eye. Beneath it, there are only stars.' },
      ],
      enter: { who: 'monoceros', text: 'Star Vault. A sky, indoors, beneath a tower. I did not calculate this.' },
      room: { who: 'monoceros', text: 'Every star here is a gate. Some are going out. I… count them.' },
      key: { who: 'monoceros', text: 'Cold, perfect workmanship. Older than me. I do not care for that.' },
      door: { who: 'monoceros', text: 'The hum is coming from behind this door. It is not pleasant.' },
      boss: [
        { who: 'nightshade', text: 'Each dark star is a gate your gate-puller opened. Count them, Mandrill.' },
        { who: 'monoceros', text: 'I have counted. The figure is… within tolerance.' },
        { who: 'nightshade', text: 'When the last one goes out, the old wars will seem gentle.' },
        { who: 'monoceros', text: 'Then I shall argue with the sky. Loudly.' },
      ],
    },
  },
  baron: {
    1: {
      bridge: [
        { who: 'narrator', text: 'Leo King’s first shot clips Crimson Baron’s wing. It spirals into a hole in the riverbank.' },
        { who: 'kabuto', text: 'The crown will collect its property below.' },
      ],
      enter: { who: 'baron', text: 'The Sunken Grotto, darling! An old-war smugglers’ dock. My kind of place.' },
      room: { who: 'baron', text: 'Old treaty crates, soaked through. Empty. Someone beat me to these.' },
      key: { who: 'baron', text: 'A key! Mine now, darling. I’m told it’s practically a profession.' },
      door: { who: 'baron', text: 'Royal wax on a flooded door? Darling, that’s rather fresh.' },
      boss: [
        { who: 'kabuto', text: 'You are a long way from the sky, Crimson Baron. Hand over the gold.' },
        { who: 'baron', text: 'Your wax is on that door, your majesty. What are you shipping down here?' },
        { who: 'kabuto', text: 'The crown’s business is the crown’s. The marble, now.' },
        { who: 'baron', text: 'Smile for the crowd, darling. Oh, there isn’t one. Pity.' },
      ],
    },
    3: {
      bridge: [
        { who: 'tyrant', text: 'Grounded means grounded, Crimson Baron.' },
        { who: 'narrator', text: 'Its wolf-head fists tear the edge off the Run, and Crimson Baron falls into the green dark below.' },
      ],
      enter: { who: 'baron', text: 'Overgrown Ruins! An old-war airfield, darling. Trees on the runway. Rude.' },
      room: { who: 'baron', text: 'Cargo logs. The first pilots flew the keystones out. It’s a family trade.' },
      key: { who: 'baron', text: 'A pilot’s key, on a rotted lanyard. I’ll return it. Eventually.' },
      door: { who: 'baron', text: 'Claw marks on this door. Tyrant King got here first. How tacky.' },
      boss: [
        { who: 'tyrant', text: 'End of the flight path, Crimson Baron. Your runway is a garden now.' },
        { who: 'baron', text: 'The first pilots flew your keystones out of here, darling. I’m keeping up tradition.' },
        { who: 'tyrant', text: 'Then you can be buried with them.' },
        { who: 'baron', text: 'You first, dear. And do smile.' },
      ],
    },
  },
  bastion: {
    1: {
      bridge: [
        { who: 'narrator', text: 'Bastion slips into a drain in the riverbank. Fang Hound, nose to the oil, goes in behind it.' },
        { who: 'liger', text: 'Run, bug. Water doesn’t hide a smell.' },
      ],
      enter: { who: 'narrator', text: 'Black water fills the Sunken Grotto, a flooded old-war workshop.' },
      room: { who: 'narrator', text: 'Tiny old-war berths, row on row. Each the size of a survey bot.' },
      key: { who: 'narrator', text: 'Bastion lifts the key on one scythe tip, and waits, listening.' },
      door: { who: 'narrator', text: 'The door opens so gently that the water does not stir.' },
      boss: [
        { who: 'liger', text: 'There you are. Old bunkers, old oil, and one quiet bug.' },
        { who: 'bastion', text: '…' },
        { who: 'liger', text: 'You stopped back there, at the little beds. What’s a killer want with those?' },
        { who: 'bastion', text: '……' },
      ],
    },
    3: {
      bridge: [
        { who: 'rex', text: 'Hold on, little ones. The floor of this pass is older than it looks.' },
        { who: 'narrator', text: 'The lead cart breaks through the sand and drags its cages down. Bastion follows them into the dark.' },
      ],
      enter: { who: 'narrator', text: 'The cart crashed down into The Crypt. Far ahead, small things are clicking.' },
      room: { who: 'narrator', text: 'Carved on a tomb: tiny bots, setting keystones beside soldiers. Honoured dead.' },
      key: { who: 'narrator', text: 'A cage key, dropped in the fall. Bastion closes a scythe on it.' },
      door: { who: 'narrator', text: 'Behind the door: Rex Saur’s grumbling, and dozens of tiny lights.' },
      boss: [
        { who: 'rex', text: 'Those tombs you passed? Survey bots helped set the keystones. We buried ’em like soldiers.' },
        { who: 'bastion', text: '…' },
        { who: 'rex', text: 'Now I’m carting ’em in cages. …Job’s a job. Let’s bite.' },
        { who: 'bastion', text: '……' },
      ],
    },
  },
  nightshade: {
    1: {
      bridge: [
        { who: 'kabuto', text: 'Kneel, then, where the old crowns kneel.' },
        { who: 'narrator', text: 'The Soccer Field splits along an old seam. Leo King descends, and Nightshade drifts down after it.' },
      ],
      enter: { who: 'nightshade', text: 'The Crypt beneath the Soccer Field. Every King the League has buried.' },
      room: { who: 'nightshade', text: 'The old Kings lie here, each with its oath. They kept them.' },
      key: { who: 'nightshade', text: 'This key has dust on it. No King has come down in seasons.' },
      door: { who: 'nightshade', text: 'Leo King forced this door. Odd, for one who should hold its key.' },
      boss: [
        { who: 'kabuto', text: 'You stand among my fathers, ghost. Show respect.' },
        { who: 'nightshade', text: 'Name one.' },
        { who: 'kabuto', text: '…The crown does not recite.' },
        { who: 'nightshade', text: 'No. I expect it does not.' },
      ],
    },
    3: {
      bridge: [
        { who: 'narrator', text: 'Rex Saur stamps twice on a buried hatch. Cold air pours up through the desert sand.' },
        { who: 'rex', text: 'Back in my day this was the coldest room in the League. Come on, ghost.' },
      ],
      enter: { who: 'nightshade', text: 'The Frozen Caverns, under burning sand. Here they chilled the old-war poison.' },
      room: { who: 'nightshade', text: 'Two posts in the ice: one to weigh the keystones, one to keep.' },
      key: { who: 'nightshade', text: 'Frost has kept this key just as I left it.' },
      door: { who: 'nightshade', text: 'I last saw my sibling through this door. It will not remember.' },
      boss: [
        { who: 'rex', text: 'You stood your post down here longer than anyone. Nobody asked you to.' },
        { who: 'nightshade', text: 'Someone had to keep them. My sibling could not.' },
        { who: 'rex', text: 'Hmph. Back in my day, we at least said thanks.' },
        { who: 'nightshade', text: 'Then thank me with your teeth, old soldier.' },
      ],
    },
  },
  violet: {
    1: {
      bridge: [
        { who: 'pioneer', text: 'Those files are in the restricted vault, ma’am. You can’t go down there!' },
        { who: 'narrator', text: 'Pioneer jumps down a service lift in the pavement to get there first. Silverback takes the stairs, and the door.' },
      ],
      enter: { who: 'violet', text: 'Neon Vault. Old-war records, and all these lights. Little ones would hide here.' },
      room: { who: 'violet', text: 'Old-war ledger. Every small bot, listed by size. Like parts.' },
      key: { who: 'violet', text: 'A small key. Little ones could carry this. I will carry it.' },
      door: { who: 'violet', text: 'Reports on missing bots, stacked against the door. Not one opened.' },
      boss: [
        { who: 'pioneer', text: 'Ma’am, this vault is League property. You’re damaging a door. Several doors!' },
        { who: 'violet', text: 'The small ones are on your shelves, and nobody came.' },
        { who: 'pioneer', text: '…There’s a backlog. That’s not the same as not caring!' },
        { who: 'violet', text: 'Then stop filing. Start finding.' },
      ],
    },
    3: {
      bridge: [
        { who: 'tyrant', text: 'You want to see what tools are for? Come down.' },
        { who: 'narrator', text: 'Tyrant King kicks open a blast door in the pit wall and goes below. Silverback follows the heat.' },
      ],
      enter: { who: 'violet', text: 'Molten Depths. Tyrant King’s workshop. Too hot for little ones.' },
      room: { who: 'violet', text: 'An old-war socket, and tiny harnesses, scorched. They practised on the little ones.' },
      key: { who: 'violet', text: 'The key was left in a small one’s harness. I will remember.' },
      door: { who: 'violet', text: 'Hot door. I will not wait for it to cool.' },
      boss: [
        { who: 'tyrant', text: 'My old-war furnace. Every gate-puller test ran here. Your little ones were quite brave.' },
        { who: 'violet', text: 'How many went in?' },
        { who: 'tyrant', text: 'I stopped counting. Tools don’t get numbers.' },
        { who: 'violet', text: 'I count. Every one.' },
      ],
    },
  },
  kabuto: {
    1: {
      bridge: [
        { who: 'narrator', text: 'Blossom snatches Leo King’s crown clean off its head and dives into a tide pool.' },
        { who: 'kabuto', text: 'GIVE THAT BACK!' },
      ],
      enter: { who: 'kabuto', text: 'The Sunken Grotto. A damp old-war shrine, and I am bareheaded in it.' },
      room: { who: 'kabuto', text: 'An old-war carving of a King. My face. …Not my face.' },
      key: { who: 'kabuto', text: 'A key, and no one watching. Even the crown must stoop.' },
      door: { who: 'kabuto', text: 'Behind this door, a small voice is trying on my crown.' },
      boss: [
        { who: 'ember', text: 'Look! I’m a King! It’s so heavy! And it’s all scratchy inside!' },
        { who: 'kabuto', text: 'Take it off. Do not look inside it.' },
        { who: 'ember', text: 'Why? What’s inside?' },
        { who: 'kabuto', text: 'Nothing. Hand it over.' },
      ],
    },
    3: {
      bridge: [
        { who: 'tyrant', text: 'A bigger price? Come and see my strongroom, if you can reach it.' },
        { who: 'narrator', text: 'The floor of the pit opens on a chain lift. Tyrant King rides it down into the glow.' },
      ],
      enter: { who: 'kabuto', text: 'Molten Depths. Tyrant King keeps its gold in an old-war furnace. Vulgar.' },
      room: { who: 'kabuto', text: 'Palace crates, stacked to the roof. My seal on every one.' },
      key: { who: 'kabuto', text: 'A gold-plated key. Its taste is terrible. I shall keep it.' },
      door: { who: 'kabuto', text: 'A crown with a bite through it, nailed to the door. Charming.' },
      boss: [
        { who: 'tyrant', text: 'Count them, Leo King. You’ve sold me half the League.' },
        { who: 'kabuto', text: 'And the half I kept is worth more. True Leo King is coming.' },
        { who: 'tyrant', text: 'Then you need me more than I need you.' },
        { who: 'kabuto', text: 'A crown needs no one. Name your price, or lose your pits.' },
      ],
    },
  },
  trueleo: {
    1: {
      bridge: [
        { who: 'baron', text: 'Private means downstairs, darling! Do wipe your feet.' },
        { who: 'narrator', text: 'Crimson Baron drops through a hatch in the glowing street with its ledger. True Leo King goes after it.' },
      ],
      enter: { who: 'trueleo', text: 'The Neon Vault. I sealed this place myself. Someone has opened it.' },
      room: { who: 'trueleo', text: 'Old treaty rolls. My signature, and a forged one beneath it.' },
      key: { who: 'trueleo', text: 'The seal on this key is mine. I never cut it.' },
      door: { who: 'trueleo', text: 'Three seasons I have waited to read what lies behind this.' },
      boss: [
        { who: 'baron', text: 'Welcome to accounts, your majesty. Or your other majesty. I do lose track.' },
        { who: 'trueleo', text: 'I found my name forged on the treaty rolls. Show me the rest.' },
        { who: 'baron', text: 'Ooh, temper. A real King would tip.' },
        { who: 'trueleo', text: 'A real King would collect.' },
      ],
    },
    3: {
      bridge: [
        { who: 'tyrant', text: 'They’re in the cellar, old lion. Mind the heat.' },
        { who: 'narrator', text: 'Tyrant King drops through the pit floor. Fang Hound holds the rim while True Leo King goes down.' },
      ],
      enter: { who: 'trueleo', text: 'Molten Depths. The treaty’s forge-room, where every gate’s setting was cast.' },
      room: { who: 'trueleo', text: 'My oath is cast into this wall. I broke it by leaving.' },
      key: { who: 'trueleo', text: 'A royal vault key, on Tyrant King’s hook. That ends today.' },
      door: { who: 'trueleo', text: 'Heat, and a hum I know. The keystones are just behind this.' },
      boss: [
        { who: 'tyrant', text: 'There they are, old lion. Every keystone Leo King sold me, on my shelf.' },
        { who: 'trueleo', text: 'And every one has a gate waiting. I swore to that on these walls.' },
        { who: 'tyrant', text: 'An oath never stopped a wolf.' },
        { who: 'trueleo', text: 'Then I will. I am late, but I am here.' },
      ],
    },
  },
  tyrant: {
    1: {
      bridge: [
        { who: 'pioneer', text: 'The League’s title to this pass is in the crypt below. I’ll be fetching it!' },
        { who: 'narrator', text: 'Pioneer drops through a hatch in the sand. Tyrant King, amused, tears the hatch off and follows.' },
      ],
      enter: { who: 'tyrant', text: 'The Crypt. Old-war generals, rows of them. Not one name I know.' },
      room: { who: 'tyrant', text: 'Every tomb has a name on it. Soon I’ll have them recut.' },
      key: { who: 'tyrant', text: 'Even the dead lock their doors. Cowards.' },
      door: { who: 'tyrant', text: 'Whatever’s behind this door, my name goes on it next.' },
      boss: [
        { who: 'pioneer', text: 'Got it! Deed to the Pass, signed the day of the treaty. “Shared by all.”' },
        { who: 'tyrant', text: 'Read the names, Pioneer. Every one of them is dead.' },
        { who: 'pioneer', text: 'Dead or not, it’s binding! I’ll read it out!' },
        { who: 'tyrant', text: 'Read it to them.' },
      ],
    },
    3: {
      bridge: [
        { who: 'baron', text: 'Mind the ice, darling. The loading chute’s quite steep!' },
        { who: 'narrator', text: 'Crimson Baron kicks its crates down an old ice chute and slides after them, into the dark below the Snowfield.' },
      ],
      enter: { who: 'tyrant', text: 'Frozen Caverns. The old-war cold store, and my crates sliding through it.' },
      room: { who: 'tyrant', text: 'Every gate’s name is cut into these shelves. Soon, only one name.' },
      key: { who: 'tyrant', text: 'A key, frozen to a crate of mine. Cracked it off.' },
      door: { who: 'tyrant', text: 'Red paint on the door: “Back soon, darling.” I’ll scrap it twice.' },
      boss: [
        { who: 'baron', text: 'Cosy, isn’t it? The old wars chilled the keystones here, before your grubby paws.' },
        { who: 'tyrant', text: 'Hand over the crates, Crimson Baron, or freeze with them.' },
        { who: 'baron', text: 'Crates? What crates, dear? I’m simply admiring the shelving.' },
        { who: 'tyrant', text: 'I’ll shelve you.' },
      ],
    },
  },
  rex: {
    1: {
      bridge: [
        { who: 'dragon', text: 'You want a fight? Come see what Tyrant King’s fire left under my pit!' },
        { who: 'narrator', text: 'Wyvern kicks through a cracked hatch in the pit floor, and Rex Saur stomps in after it.' },
      ],
      enter: { who: 'rex', text: 'Molten Depths. Back in my day, this was a barracks. Now it’s soup.' },
      room: { who: 'rex', text: 'Scratches on the wall. Old-war squad marks. …One of ’em’s mine.' },
      key: { who: 'rex', text: 'Key’s hot. Bit it anyway. Still works.' },
      door: { who: 'rex', text: 'Door’s got a gate carved on it. We built those to end this.' },
      boss: [
        { who: 'dragon', text: 'See this? Your old squad held this place so there’d be pits up top!' },
        { who: 'rex', text: 'That was a long time ago, scrap pile.' },
        { who: 'dragon', text: 'And now you ride with Tyrant King, who burned it!' },
        { who: 'rex', text: 'Quit looking at me like that. Bite first, talk later.' },
      ],
    },
    3: {
      bridge: [
        { who: 'tyrant', text: 'Want your keystone, fossil? Go down the hole it came out of.' },
        { who: 'narrator', text: 'Tyrant King drops down a shaft in the floor of the Pass. Rex Saur goes after it, teeth first.' },
      ],
      enter: { who: 'rex', text: 'The Crypt, under my gate. We buried the keystone setters here. All but me.' },
      room: { who: 'rex', text: 'Hmph. The bones are up and walking. Somebody’s been digging ’em out.' },
      key: { who: 'rex', text: 'Still round an old friend’s neck. Sorry, pal. I’ll bring it back.' },
      door: { who: 'rex', text: 'I carved this door with my teeth. Back then I had more.' },
      boss: [
        { who: 'tyrant', text: 'Your friends make good guards, fossil. They don’t even ask for pay.' },
        { who: 'rex', text: 'You dug up my crew.' },
        { who: 'tyrant', text: 'They were in my way. So are you.' },
        { who: 'rex', text: 'Back in my day, the dead stayed down. So will you.' },
      ],
    },
  },
  liger: {
    1: {
      bridge: [
        { who: 'violet', text: 'A little one has fallen through the ice. Stand back.' },
        { who: 'narrator', text: 'Silverback drops into the crevasse. Fang Hound swears it is not following, and follows.' },
      ],
      enter: { who: 'liger', text: 'Frozen Caverns. An old guard post. Not my problem. None of this is.' },
      room: { who: 'liger', text: 'A survey bot, shaking in the ice. I stepped in front. Habit.' },
      key: { who: 'liger', text: 'Frozen in a dead sentry’s grip. It never left its post.' },
      door: { who: 'liger', text: 'Another little bot by the door. Fine. Behind me. Quickly.' },
      boss: [
        { who: 'violet', text: 'That sentry held its post for an age, long after everyone forgot it.' },
        { who: 'liger', text: 'More fool it.' },
        { who: 'violet', text: 'You stopped to look.' },
        { who: 'liger', text: 'I stopped to fight. Start swinging.' },
      ],
    },
    3: {
      bridge: [
        { who: 'nightshade', text: 'The answer lies under the grove. I will not carry you to it.' },
        { who: 'narrator', text: 'Nightshade sinks through the roots like smoke. Fang Hound digs in after it.' },
      ],
      enter: { who: 'liger', text: 'Overgrown Ruins. A throne room, under a forest. Who leaves a throne?' },
      room: { who: 'liger', text: 'No seat on this throne. Only a socket, for a keystone.' },
      key: { who: 'liger', text: 'Key’s been left out, like bait. Fine. I’ll bite.' },
      door: { who: 'liger', text: 'A crown carved over a gate, like a lid. Like a guard.' },
      boss: [
        { who: 'nightshade', text: 'You have seen the throne. Tell me what its King sat on.' },
        { who: 'liger', text: 'A rock. Some crown.' },
        { who: 'nightshade', text: 'It sat on its duty. What will you sit on?' },
        { who: 'liger', text: 'Whatever I win. Hold still, ghost.' },
      ],
    },
  },
  ember: {
    1: {
      bridge: [
        { who: 'narrator', text: 'Bastion melts into a hole between the roots. Blossom squeals with joy and jumps in after it.' },
        { who: 'ember', text: 'Hide and seek! I LOVE hide and seek!' },
      ],
      enter: { who: 'ember', text: 'Ooh! The Overgrown Ruins! There’s a whole house under the trees!' },
      room: { who: 'ember', text: 'Little tiny doors! Little tiny stairs! Who lives here? Hello?' },
      key: { who: 'ember', text: 'A key! What does it open? Egg, do you know? Egg knows.' },
      door: { who: 'ember', text: 'This door is so BIG! Knock knock! Bastion, it’s me!' },
      boss: [
        { who: 'ember', text: 'Found you! That’s one for me! Who lives in the tiny house?' },
        { who: 'bastion', text: '…' },
        { who: 'ember', text: 'Is it a secret? I’m SO good at secrets! Egg, tell it!' },
        { who: 'bastion', text: '……' },
      ],
    },
    3: {
      bridge: [
        { who: 'ember', text: 'No! You can’t have it! BYE!' },
        { who: 'narrator', text: 'Blossom dives into a bubbling blowhole in the reef. Crimson Baron, smiling, knows another way down.' },
      ],
      enter: { who: 'ember', text: 'The Sunken Grotto! Everything is bubbles! Egg, we’re INSIDE the bubbles!' },
      room: { who: 'ember', text: 'A shiny old wall full of holes! One’s just my egg’s size!' },
      key: { who: 'ember', text: 'I got a key! It tickles! Egg, you hold it. No, me!' },
      door: { who: 'ember', text: 'Egg’s humming louder! Don’t be scared, egg! I’m here!' },
      boss: [
        { who: 'baron', text: 'That old wall has waited a long time for something your shape, sweet thing.' },
        { who: 'ember', text: 'My egg fits! Did you see? It wants to go in!' },
        { who: 'baron', text: 'Not here, darling. Hand it over and I’ll see it’s looked after.' },
        { who: 'ember', text: 'No borrowing! Egg says NO borrowing!' },
      ],
    },
  },
};
