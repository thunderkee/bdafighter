import type { Line } from './storymode';

/**
 * League Story's evolutions: what happens, in each path, as its hero becomes its next form.
 * [path][0..3] are the scenes going into chapters 3, 4, 5 and the finale (forms II to V).
 */
export const EVOLVE_SCENES: Record<string, [Line[], Line[], Line[], Line[]]> = {
  angel: [
    [
      { who: 'narrator', text: '“It has your face.” Crimson Baron’s words echo through the Overgrown Ruins.' },
      { who: 'angel', text: 'No more drifting toward a signal. I vow to reach whoever wears my face.' },
      { who: 'narrator', text: 'White plates lock over its chest. Seraph Vow climbs out, toward the Snowfield.' },
    ],
    [
      { who: 'narrator', text: 'Silverback’s blows have shaken something loose: an old treaty-war routine, sealed deep in Seraph’s body.' },
      { who: 'angel', text: 'Measured, it said. My body remembers what I don’t.' },
      { who: 'narrator', text: 'The routine unfolds wings. Seraph becomes Archon and crosses the Snowfield.' },
    ],
    [
      { who: 'narrator', text: 'The signal’s light fills the hollow where Seraph’s memory was. Seraph becomes Archon Prime.' },
      { who: 'angel', text: 'No one will use me. Not my makers, not the Spire. Archon Prime chooses.' },
    ],
    [
      { who: 'narrator', text: 'Every keystone in the Crystal Court flares at once. They know Seraph, who measured them.' },
      { who: 'angel', text: 'I can’t remember you. But you remember me. Lend me your light.' },
      { who: 'narrator', text: 'Gold wings burst. Seraph becomes Empyrean, first and final measure, and dives for the Neon District.' },
    ],
  ],
  dragon: [
    [
      { who: 'narrator', text: 'Wyvern rips plating off an old-war tomb, welds it on in the Crypt, and becomes Scalewyrm.' },
      { who: 'dragon', text: 'Scrap built me. Scrap’ll do! Scalewyrm’s off to Neo City to see Mandrill!' },
    ],
    [
      { who: 'narrator', text: 'Tyrant King never got the keystone! All five engines burn hotter, and Wyvern becomes Cinderdrake.' },
      { who: 'dragon', text: 'Hear that, boys? Our pit’s still got a heart! Cinderdrake, coming through!' },
    ],
    [
      { who: 'narrator', text: 'Rex Saur spits out an old-war engine mount. It lands at Wyvern’s feet, still warm.' },
      { who: 'dragon', text: 'A gift from Rex Saur? …Fits perfect. Wyvern’s Infernodrake now. Thanks for nothing.' },
    ],
    [
      { who: 'narrator', text: 'Blossom is in danger. Five scrapped machines inside Wyvern remember their pits, and wake as one.' },
      { who: 'dragon', text: 'Nobody touches Blossom! Not while these engines run!' },
      { who: 'narrator', text: 'Ash-black wings open in fire. Wyvern becomes Ashwing Sovereign and hits the Lava Forge like a meteor.' },
    ],
  ],
  pioneer: [
    [
      { who: 'narrator', text: 'A gate-puller sale is a League-level case. Deep in the Neon Vault, Pioneer finds a heavier old-war body.' },
      { who: 'pioneer', text: 'Bigger case, bigger badge. Says so in section nine. Sergeant Pioneer, reporting for desert duty.' },
    ],
    [
      { who: 'narrator', text: 'Pioneer bags the broken cage bars as evidence, then welds one across its chest.' },
      { who: 'pioneer', text: 'So I don’t forget who this badge is for. Captain Pioneer, on the case.' },
    ],
    [
      { who: 'narrator', text: 'Pioneer reads to the last page of its book. There’s a clause in old treaty ink.' },
      { who: 'pioneer', text: 'In a threat to the gates, League police command every arena. Well. That’s me.' },
      { who: 'narrator', text: 'Old-war command armour unlocks. Pioneer becomes The Commissioner and takes the Serpent Run.' },
    ],
    [
      { who: 'narrator', text: 'The Spire’s signal reads Pioneer’s badge: three seasons on one case, and not one day off.' },
      { who: 'narrator', text: 'Gold and blue armour slams on. Pioneer becomes the League’s oldest rank: High Marshal.' },
      { who: 'pioneer', text: 'Crimson Baron, this is the last stop. And I brought the whole rulebook.' },
    ],
  ],
  liberty: [
    [
      { who: 'narrator', text: 'Deep in the laughing cave, Liberty hauls out the drones’ dropped sonar mast.' },
      { who: 'liberty', text: 'Can’t stop what I can’t see. Now I see. Liberty Vigil stands watch.' },
    ],
    [
      { who: 'narrator', text: 'Liberty cracks open the crushed drone and wires its power cell to an old dive lamp.' },
      { who: 'liberty', text: 'I judged you in the dark, Bastion. Next time I’ll have light.' },
      { who: 'narrator', text: 'The lamp burns through the rain. Liberty becomes Beacon and rolls for River Dusk.' },
    ],
    [
      { who: 'narrator', text: 'Deep in the Neon Vault, Liberty feels the tide gate flicker. It stacks taller, its lamp swings seaward, and it becomes Lighthouse.' },
      { who: 'liberty', text: 'My beach. My keystone. Let it see me from here. Lighthouse, holding.' },
    ],
    [
      { who: 'narrator', text: 'Dawn breaks over the Serpent Run. Neo City lies ahead, and Liberty has never been this far from its sand.' },
      { who: 'narrator', text: 'Years of standing still come due. Gold rises, tread over tread: Liberty becomes the Colossus of Dawn.' },
      { who: 'liberty', text: 'I don’t move. I arrive.' },
    ],
  ],
  monoceros: [
    [
      { who: 'narrator', text: 'Mandrill feeds its readings of the “egg” into its own head. Its head gets bigger.' },
      { who: 'monoceros', text: 'Keystone data! In MY brain! Note it: I am now Mad Mandrill. It’s a title.' },
    ],
    [
      { who: 'narrator', text: 'For once, Mandrill is worried. It copes by adding drills, and becomes Doctor Drill.' },
      { who: 'monoceros', text: 'Doctor Drill will examine this Spire. Thoroughly. Calmly. I am calm. I am VERY calm.' },
    ],
    [
      { who: 'narrator', text: 'The Spire’s hum has rattled loose an idea Mandrill never had before: it might be wrong.' },
      { who: 'monoceros', text: 'Intolerable! I’ll rebuild my head. Mandrill is now Professor Primate, with a lesson for Tyrant King.' },
    ],
    [
      { who: 'narrator', text: 'Mandrill scoops the gate-puller’s shattered core off the rocks and bolts it between its cannons.' },
      { who: 'monoceros', text: 'Nine hundred and twelve days of planning! Behold step four and a half!' },
      { who: 'narrator', text: 'Purple armour unfurls. Mandrill, now Apex Simian, rolls south, laughing so loud gulls leave.' },
    ],
  ],
  baron: [
    [
      { who: 'narrator', text: 'At the back of the old smugglers’ dock, Crimson Baron unwraps the racing wings the League once grounded.' },
      { who: 'baron', text: 'Hello, gorgeous. Tyrant King is coming, so the Crimson Ace wears the good wings.' },
    ],
    [
      { who: 'narrator', text: 'Old pilots Tyrant King once grounded wait past the desert, with spare guns and red paint.' },
      { who: 'baron', text: 'You all came! For me! Smile, darlings: Crimson Baron flies as Red Squadron now.' },
    ],
    [
      { who: 'narrator', text: 'Deep in the Overgrown Ruins, the golden marble sings. Its light turns Crimson Baron into Sky Duke.' },
      { who: 'baron', text: 'Oh, don’t thank me yet, darling. …All right, thank me. Sky Duke sounds lovely.' },
    ],
    [
      { who: 'narrator', text: 'Every keystone Crimson Baron ever carried lights up in the Court, calling it home.' },
      { who: 'narrator', text: 'Black and scarlet plate, trimmed in gold. Crimson Baron becomes the Scarlet Emperor and takes the stage.' },
      { who: 'baron', text: 'One last delivery, darlings, and I do believe I’m overdressed. Smile for the crowd!' },
    ],
  ],
  bastion: [
    [
      { who: 'narrator', text: 'In the black water of the Grotto, Bastion strips the claws from a drone and sets them along its back.' },
      { who: 'bastion', text: '…' },
      { who: 'narrator', text: 'In the dark, the claws take like thorns. Thorn Bastion follows the oil.' },
    ],
    [
      { who: 'narrator', text: 'Under the lights, Bastion reads the plans. It counts the cages. Then it counts again.' },
      { who: 'bastion', text: '……' },
      { who: 'narrator', text: 'Its scythes grow long in silence. Nobody in the city sees Bastion leave as Scythemantis.' },
    ],
    [
      { who: 'narrator', text: 'The freed survey bots won’t leave. They swarm up Bastion’s legs and start quietly rebuilding it.' },
      { who: 'bastion', text: '…' },
      { who: 'narrator', text: 'By the Rainy Forest, Bastion wears a hive of busy lights. As Hive Reaper, it walks very carefully.' },
    ],
    [
      { who: 'narrator', text: 'Silverback is coming. Each little bot gives up one part, and together they build a crown.' },
      { who: 'bastion', text: '……' },
      { who: 'narrator', text: 'Two scythes open. Bastion, now the Mantis Regent, stands before its nest and does not hide.' },
    ],
  ],
  nightshade: [
    [
      { who: 'narrator', text: 'Another gate goes dark. The Spire’s signal reaches down for Nightshade and wraps it in shadow.' },
      { who: 'nightshade', text: 'Yes, I hear you. A veil, then. Nightshade goes unseen as Dusk Veil.' },
    ],
    [
      { who: 'narrator', text: 'Nightshade holds Crimson Baron’s stolen keystone one moment too long. Dark petals open along its tail.' },
      { who: 'nightshade', text: 'Seven gates dark, and every keystone full of old-war poison. I will keep that too.' },
      { who: 'narrator', text: 'Nightshade, now Belladonna, drifts out toward Sandglass Pass.' },
    ],
    [
      { who: 'narrator', text: 'Alone on the ice, Nightshade lets itself grieve the sibling who forgot. It lasts one moment.' },
      { who: 'nightshade', text: 'Grief is only another thing to keep. Let it bloom.' },
      { who: 'narrator', text: 'Pale petals ring its hood. Nightshade, now Wraith Bloom, rises for the Court as a second tremor hits.' },
    ],
    [
      { who: 'narrator', text: 'Far above, the Orbital Deck’s build cradle wakes. It still has one unfinished job: Nightshade.' },
      { who: 'nightshade', text: 'Finish me, then. My sibling deserves all of what I was meant to be.' },
      { who: 'narrator', text: 'Pale plate and gold fire close in. Nightshade, now Eclipse Nocturne, opens its eyes and rises to the Deck.' },
    ],
  ],
  violet: [
    [
      { who: 'narrator', text: 'Pioneer unlocks the Neon Vault’s impound. Silverback straps on iron from a seized caravan and becomes Ironback.' },
      { who: 'violet', text: 'Cages are made of this. Now it protects them. Ironback goes to the Pass.' },
    ],
    [
      { who: 'narrator', text: 'One survey bot’s name tag lies in an empty cage. Silverback holds it a long time.' },
      { who: 'violet', text: 'Not lost. Not while I stand. Harder, then. I will be harder.' },
      { who: 'narrator', text: 'Its back sets like steel. Silverback, now Steelback, turns toward the Lava Forge.' },
    ],
    [
      { who: 'narrator', text: 'Tyrant King called them tools. Silverback, slow to anger its whole life, is finally angry.' },
      { who: 'violet', text: 'Tools. …Left, right, left.' },
      { who: 'narrator', text: 'Hot steel swells over its shoulders. Silverback, now Titanback, walks for the Neon District. Nothing blocks the road.' },
    ],
    [
      { who: 'narrator', text: 'In the neon glow, Silverback’s old guardian beacon picks up dozens of tiny pings from the Rainy Forest. They are alive.' },
      { who: 'violet', text: 'I hear you. Stay behind me. All of you. Not one more.' },
      { who: 'narrator', text: 'White armour climbs it like a mountain. Silverback, now Peakback Primal, walks for the Rainy Forest.' },
    ],
  ],
  kabuto: [
    [
      { who: 'narrator', text: 'Leo King melts down a bag of Tyrant King’s gold and pours it over the scratched-out name.' },
      { who: 'kabuto', text: 'No one will read that now. Gilded Leo is all anyone will see.' },
    ],
    [
      { who: 'narrator', text: 'Leo King taps the keystone it’s selling and sips its light. Then sips some more.' },
      { who: 'kabuto', text: 'A keystone can lose a little weight. Buyers never check. Look how I shine.' },
      { who: 'narrator', text: 'Gold spreads over old cracks. Something rattles inside. Leo King, now the Gold Pretender, rides for the Lava Forge.' },
    ],
    [
      { who: 'narrator', text: 'Before the climb, Leo King empties its own palace crates onto itself. Capes, medals, a second crown.' },
      { who: 'kabuto', text: 'A king needs one crown. An emperor needs more.' },
      { who: 'narrator', text: 'Emperor, Leo King names itself. Far above, the League says False Emperor.' },
    ],
    [
      { who: 'narrator', text: 'Refused by the Spire, Leo King crushes stolen keystones against its chest and drinks them dry.' },
      { who: 'kabuto', text: 'Leo King, Usurper Absolute! Let True Leo King come. Let them all kneel.' },
      { who: 'narrator', text: 'Not a soul answers. Knock on all that gold, and you’d hear nothing inside.' },
    ],
  ],
  tyrant: [
    [
      { who: 'narrator', text: 'Tyrant King has its toll gold beaten into armour, with its name on every plate.' },
      { who: 'tyrant', text: 'Regent of every road I’ve taken. Tyrant Regent, for now. Mandrill can bill me.' },
    ],
    [
      { who: 'narrator', text: 'Tyrant King leaves Neo City as Hellmaster, the lab’s best prototypes bolted to its wolf-head fists.' },
      { who: 'tyrant', text: 'Consider your bill paid, Mandrill. Hellmaster doesn’t read invoices.' },
    ],
    [
      { who: 'narrator', text: 'Furious, Tyrant King clamps the gate-puller to its own chest and turns it on.' },
      { who: 'tyrant', text: 'Every keystone I’ve pulled, pouring into ME. Let Crimson Baron try to outrun this.' },
      { who: 'narrator', text: 'Dark gates flare across the League, and Tyrant Ascendant rises, burning.' },
    ],
    [
      { who: 'narrator', text: 'On the road to the Forge, Tyrant King feeds its last vault keystones to its wolves.' },
      { who: 'narrator', text: 'Both fists open their eyes and snarl. Three heads, one hunger: Tyrant King becomes Cerberus Rex.' },
      { who: 'tyrant', text: 'No partners. No plans but mine. Burn it again, boys.' },
    ],
  ],
  rex: [
    [
      { who: 'narrator', text: 'Wyvern’s heat cracks an old seal in Rex Saur’s back, and glacier coolant comes leaking out.' },
      { who: 'rex', text: 'Hmph. Haven’t felt that since the ice. Back in my day we called this Frost Rex.' },
    ],
    [
      { who: 'narrator', text: '“Your keystones.” The words sink into Rex Saur and keep sinking, down to the old war.' },
      { who: 'rex', text: 'Mine. I remember the weight of ’em. …Nap’s over.' },
      { who: 'narrator', text: 'Ice climbs its shoulders like a slow tide. Glacier Rex stomps toward Sandglass Pass.' },
    ],
    [
      { who: 'narrator', text: 'Rex Saur bites the edge of its old crew’s tomb, and swears on the taste of it.' },
      { who: 'rex', text: 'Second war, same teeth. This time I don’t thaw till the gates are lit.' },
      { who: 'narrator', text: 'Frost locks deep into every bolt. Permafrost Rex starts up the Spire.' },
    ],
    [
      { who: 'narrator', text: 'Rex Saur touches the first keystone it ever set. It gives back an age of cold.' },
      { who: 'narrator', text: 'Vast white armour thunders on. The Court’s floor freezes. Rex Saur walks as The Ice Age.' },
      { who: 'rex', text: 'All this, for one egg. Back in my day, eggs came to YOU.' },
    ],
  ],
  liger: [
    [
      { who: 'narrator', text: 'Fang Hound tears off its royal guard badge and grinds its plates down to edges.' },
      { who: 'liger', text: 'Guards stand. Strikers hunt. Fang Striker stands for nobody. …Mostly.' },
    ],
    [
      { who: 'narrator', text: '“You kept looking back.” Seraph’s words run hot through Fang Hound, out on the Snowfield.' },
      { who: 'liger', text: 'I did not. …I did. So I’ll run too fast to look back.' },
      { who: 'narrator', text: 'Razor fins snap open. Fang Hound, now Razorhound, heads for the Rainy Forest.' },
    ],
    [
      { who: 'narrator', text: 'Deep in the Overgrown Ruins lies a rusted old-war guard dog, still curled around the gate it kept.' },
      { who: 'liger', text: 'So that’s what you were keeping. I’ll take your collar, old one. I’ll earn it.' },
      { who: 'narrator', text: 'Black and gold plate bolts on. Fang Hound, now Warhound Alpha, runs for the Lava Forge.' },
    ],
    [
      { who: 'narrator', text: 'Tyrant King’s crown lies in the ash. Fang Hound picks it up, and bites it in half.' },
      { who: 'narrator', text: 'Dark-gate metal runs down its jaws and spine. Black and gold blaze. Fang Hound becomes Fenris Prime.' },
      { who: 'liger', text: 'No one gave me this. I took it apart. Fenris Prime is going home.' },
    ],
  ],
  ember: [
    [
      { who: 'narrator', text: 'Blossom hiccups, and petals pop out of its head. That orange button had a delay.' },
      { who: 'ember', text: 'Ooh! I’m a Petal now! Egg, look! Egg, are you looking?' },
    ],
    [
      { who: 'narrator', text: 'Liberty said to hold the egg close. Blossom holds it VERY close, and something starts growing.' },
      { who: 'ember', text: 'Why am I taller? Egg, did you do that? Who’s a Bloomling? ME!' },
    ],
    [
      { who: 'narrator', text: 'Blossom tries the heart on as a hat. The keystone hums, delighted, and flowers burst everywhere.' },
      { who: 'ember', text: 'Am I in trouble? I have a CROWN! Blossom’s a Spring Empress! Is that a job?' },
    ],
    [
      { who: 'narrator', text: 'Blossom races along the lava, hugging its heart. Everywhere its feet land, flowers come up anyway.' },
      { who: 'ember', text: 'Egg, it’s lava and I’m BLOOMING! What did I press?! I didn’t press ANYTHING!' },
      { who: 'narrator', text: 'A great pink-and-gold bloom opens over the Forge. Nobody, least of all Blossom, expected Everbloom.' },
    ],
  ],
  trueleo: [
    [
      { who: 'narrator', text: 'True Leo King reads every page of the ledger. Each sale is one more gate gone dark.' },
      { who: 'trueleo', text: 'Let the hood stay, then. Exile Leo will wear the road until this is paid.' },
      { who: 'narrator', text: 'True Leo King, now Exile Leo, turns north in road-worn plate.' },
    ],
    [
      { who: 'narrator', text: 'Fang Hound digs up what it carried out of the palace: True Leo King’s own battle plate.' },
      { who: 'trueleo', text: 'You kept this, all this time? Then I had better be worth it.' },
      { who: 'narrator', text: 'It still fits. True Leo King, now The Returning King, marches on the Lava Forge with Fang Hound.' },
    ],
    [
      { who: 'narrator', text: 'The sold keystones glow at the touch of True Leo King, who swore to keep them.' },
      { who: 'trueleo', text: 'You remember me. Then I will not be late again.' },
      { who: 'narrator', text: 'Red and gold return. True Leo King, now Lion Restored, runs for the Spire.' },
    ],
    [
      { who: 'narrator', text: 'The Spire refused Leo King. Now its signal falls on True Leo King, and it is warm.' },
      { who: 'trueleo', text: 'I kept none of your gates. From today, I keep them all.' },
      { who: 'narrator', text: 'Crimson and gold blaze. True Leo King, now The Rightful Sovereign, heads down to the Soccer Field, and home.' },
    ],
  ],
};
