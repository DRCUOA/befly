import { storyCraftRepo } from '../repositories/storycraft.repo.js'
import { Character } from '../models/StoryCraft.js'

/**
 * Seed importer for the St Cormac's project.
 *
 * Pulls the canonical character / motif / scene-seed material out of
 * `seed_plot_and_character_st_cormac.json` (now baked into this file as a
 * literal so we don't depend on the upload still being on disk) and creates
 * matching rows in characters / motifs / beats / motif_voice_variants /
 * causal_links inside an empty (or empty-ish) target manuscript.
 *
 * Idempotency: skips characters/motifs/beats whose name (or label) already
 * exists in the manuscript. The user can run it twice without duplicates.
 */

interface SeedResult {
  characters: number
  motifs: number
  beats: number
  causalLinks: number
  skipped: { characters: number; motifs: number; beats: number }
}

/* The seed data is reproduced inline as a TypeScript literal so the importer
 * has no runtime file dependency. Edits should be kept in lockstep with
 * `seed_plot_and_character_st_cormac.json`. */
const SEED = {
  characters: [
    {
      name: 'Jake',
      role: 'Privileged St Cormac\'s boy, footballer, emotionally avoidant centre of embodied recognition.',
      socialPosition: 'Inside privilege. He belongs before he has to earn belonging.',
      contradiction: 'Physically fearless, emotionally avoidant.',
      publicWant: 'To belong, to win, to be seen as strong, to maintain control.',
      privateWant: 'To keep Marcus close without naming the feeling.',
      hiddenNeed: 'To recognise desire and grief without converting them into shame, violence, or denial.',
      greatestFear: 'Being seen as weak, wrong, dependent, soft, or exposed.',
      falseBelief: 'If something cannot be said, it can be controlled.',
      wound: 'Inherited masculinity, paternal expectation, class confidence that leaves him emotionally untrained.',
      voice: {
        sentenceLength: 'Short to medium, especially early.',
        rhythm: 'Direct, physical, often simple. Subordinate clauses creep in as control slips.',
        preferredWords: ['football','movement','balance','weather','bodies','winning','control'],
        forbiddenWords: ['love','want','desire','afraid','grief'],
        metaphorSources: ['Football','weather','physical contest','rank'],
        attentionPattern: 'Notices bodies, movement, rooms as playing fields, threat, status, and whether someone is off-balance.',
        avoidancePattern: 'Does not discuss his mother. Talks around his father. Converts emotional events into physical ones.',
        howEmotionLeaks: 'Shorter sentences, repeated "I", physical action, fouls, running, avoidance.',
        sampleSentenceNeutral: 'The thing about the place was the smell. Polish first. Then stone. Then something like church, though I would not have said that then.',
        sampleSentenceUnderPressure: 'I saw him. I looked away. I looked back. He had mud on his face and I hated him for standing there as if he had not been gone all year.',
      },
      arcPhases: ['Belonging','Attachment without language','Deflection','False story','Volatility','Revelation','Recognition','Brief public action','Separation'],
      plotFunctions: [
        'Establishes St Cormac\'s from inside privilege.',
        'Embodies the attraction/denial axis.',
        'Provides the reader with desire before self-knowledge.',
        'Accepts enough of the false story to make the separation possible.',
        'Carries the late recognition after John Ellery\'s sentence.',
        'Turns recognition into action by crossing the mud.',
      ],
      misreadings: [
        { label: 'Misreads his own longing as irritation, loyalty, competitiveness, or protectiveness.' },
        { label: 'Misreads Marcus\'s grief and silence as guilt or betrayal.' },
        { label: 'Misreads Thomas\'s deterioration because he lacks the emotional vocabulary to interpret it.' },
        { label: 'Misreads the official story because it protects him from self-knowledge.' },
      ],
      color: '#8B5A3C',
    },
    {
      name: 'Marcus',
      fullName: 'Marcus Webb',
      role: 'Scholarship or socially less secure boy, observer, emotional counterpoint to Jake.',
      socialPosition: 'Inside the school but not fully of it. Reads rooms carefully because belonging is conditional.',
      contradiction: 'Sees almost everything, permits himself to know almost nothing.',
      publicWant: 'To survive St Cormac\'s without humiliation, to earn his place, to avoid making claims he cannot defend.',
      privateWant: 'To be chosen by Jake in a way that feels undeniable.',
      hiddenNeed: 'To trust his own perception enough to speak before proof arrives.',
      greatestFear: 'Being presumptuous, ridiculous, exposed, socially wrong, or responsible for making things worse.',
      falseBelief: 'Perception without proof is not enough to act on.',
      wound: 'Class anxiety, maternal ambition, conditional belonging, emotional restraint learned as survival.',
      voice: {
        sentenceLength: 'Longer, qualified, careful.',
        rhythm: 'Often uses clauses, dashes, colons, and conditional phrasing.',
        preferredWords: ['faces','hands','rooms','later','perhaps','I think','I could be wrong','though I did not say so'],
        forbiddenWords: ['simple certainty','open accusation'],
        metaphorSources: ['Books','rooms','class markers','social weather','faces','hands'],
        attentionPattern: 'Notices what people do with their eyes, hands, laughter, clothes, timing, and silence.',
        avoidancePattern: 'Avoids claiming grief or desire as his own entitlement.',
        howEmotionLeaks: 'Over-qualification, precise observation, delayed admission, noticing small physical details.',
        sampleSentenceNeutral: 'I noticed, because I had already learned that noticing was safer than asking, that the boys who belonged did not look around to see whether they did.',
        sampleSentenceUnderPressure: 'I might have said something then. I have told myself that often enough for it to have the shape of truth, though it is not, strictly speaking, true.',
      },
      arcPhases: ['Arrival as outsider','Observation','Attachment to Jake','Perception of Thomas changing','Hesitation','Mistranslation','Grief','Transfer','Partial recovery','Cup final confrontation','Recognition without possession'],
      plotFunctions: [
        'Re-establishes St Cormac\'s from outside privilege.',
        'Shows the reader what Jake misses.',
        'Carries the near-knowledge of Thomas\'s danger.',
        'Makes the bathroom scene morally devastating because his answer is understandable and wrong.',
        'Becomes the object of the false story and transfer.',
        'Returns at Alderton as altered but not healed.',
      ],
      misreadings: [
        { label: 'Misreads Thomas\'s crisis in the bathroom because he interprets it through shame and sexuality rather than abuse.' },
        { label: 'Misreads Jake\'s silence as rejection or belief in the official story.' },
        { label: 'Misreads his own longing as admiration, gratitude, or excessive friendship.' },
        { label: 'May suspect Declan earlier than he admits, but does not allow suspicion to become knowledge.' },
      ],
      color: '#3D6480',
    },
    {
      name: 'Thomas',
      fullName: 'Thomas Ellery',
      role: 'Bright, warm, perceptive boy whose voice becomes the novel\'s haunting absence.',
      socialPosition: 'Within the school but increasingly isolated. Emotionally and intellectually alive in a place that punishes vulnerability.',
      contradiction: 'Understands others clearly, cannot make himself understood.',
      publicWant: 'To stay ordinary, liked, clever, safe, and intelligible.',
      privateWant: 'To be rescued without having to say the unsayable.',
      hiddenNeed: 'Protection from an adult and language that can carry what is happening.',
      greatestFear: 'That what has been done to him means he is dirty, complicit, damned, or already lost.',
      falseBelief: 'If he can find the right phrase, someone will understand without him having to say everything.',
      wound: 'Predatory adult attention, Catholic shame, institutional isolation, collapse of bodily safety.',
      voice: {
        sentenceLength: 'Quick and warm early; shorter and broken later.',
        rhythm: 'Lateral, witty, capable of Latin jokes early. Sentences start and fail to finish in the middle. Fragments and white space at the end.',
        preferredWords: ['Latin','translation','numbers','ceilings','letters','phrases'],
        forbiddenWords: ['adult-trauma vocabulary'],
        metaphorSources: ['Latin','translation','chapel surfaces','numbers','small absurdities'],
        attentionPattern: 'Notices language, mismatch, jokes, tiny signs of feeling between others, and later countable objects.',
        avoidancePattern: 'Avoids direct reference to his body and to what Declan does.',
        howEmotionLeaks: 'Syntax breaks, repetition, counting, crossed-out phrases, over-specific surfaces.',
        sampleSentenceNeutral: 'Odi et amo, Brother Declan said, and Hale whispered that Latin was what happened when English died and nobody had the decency to bury it.',
        sampleSentenceUnderPressure: 'There are twelve panels above the altar. Not eleven. I counted again because eleven would have meant I had missed one.',
      },
      arcPhases: ['Warmth','Lateral intelligence','Insight','Declan\'s attention','Unease','Counting and surfaces','Fragmentation','Failed appeal','Death','Coda'],
      plotFunctions: [
        'Provides early warmth so later absence matters.',
        'Sees Jake and Marcus clearly before they see themselves.',
        'Carries the abuse plot through silence and voice fracture.',
        'Makes the reader feel the failure of language.',
        'Becomes the moral absence around which the rest of the book turns.',
        'Returns in coda as unresolved fragment.',
      ],
      misreadings: [
        { label: 'Believes partial disclosure may be enough.' },
        { label: 'May believe Marcus can infer what he cannot say.' },
        { label: 'May interpret his own body\'s responses or silence as guilt.' },
        { label: 'May believe the institution\'s moral categories apply to him.' },
      ],
      color: '#9C6B47',
    },
    {
      name: 'Diana',
      fullName: 'Diana Webb',
      role: 'Marcus\'s mother; articulate, loving, controlling, and catastrophically selective.',
      socialPosition: 'Anxious aspirational parent navigating class, respectability, school authority, and maternal fear.',
      contradiction: 'Loves her son truthfully, protects the wrong version of him.',
      publicWant: 'To protect Marcus\'s future.',
      privateWant: 'To preserve a version of Marcus she can understand and present safely to the world.',
      hiddenNeed: 'To listen before acting, but she cannot tolerate the uncertainty.',
      greatestFear: 'That Marcus will be marked, ruined, deviant, vulnerable, or socially destroyed.',
      falseBelief: 'The right adult authority can contain the problem discreetly.',
      wound: 'Class insecurity, maternal control, gendered isolation, fear of scandal, trust in institutional language.',
      voice: {
        sentenceLength: 'Long, fluent, articulate.',
        rhythm: 'Self-clarifying, parenthetical, controlled.',
        preferredWords: ['to be clear','to be precise','not that','I only mean','what any mother would do','future','care','sensible'],
        forbiddenWords: ['ex-husband\'s name','direct acknowledgement of catastrophic responsibility'],
        metaphorSources: ['Domestic order','sacrifice','maternal duty','respectability','education as rescue'],
        attentionPattern: 'Notices presentation, clothes, letters, tone, school authority, what can be explained.',
        avoidancePattern: 'Selects rather than lies. Leaves out what would destabilise her preferred version.',
        howEmotionLeaks: 'Correction, qualification, careful category-making, tenderness followed by control.',
        sampleSentenceNeutral: 'I want to be clear that I did not go to the school in anger. Concern, yes. Fear, perhaps, though fear is a word one uses after the event, when it has become respectable.',
      },
      arcPhases: ['Concern','Discovery','Interpretation','Decision','Visit to Declan','Self-justification','Story-shaping','No full recognition'],
      plotFunctions: [
        'Brings the adult world into the boys\' tragedy.',
        'Converts private adolescent feeling into institutional danger.',
        'Gives Declan information or opportunity through misplaced trust.',
        'Shapes the false story after Thomas\'s death.',
        'Embodies love as harm without becoming a cartoon villain.',
      ],
      misreadings: [
        { label: 'Misreads Marcus\'s notebook or inner life.' },
        { label: 'Misreads Jake\'s role in Marcus\'s emotional world.' },
        { label: 'Misreads Declan as a safe authority.' },
        { label: 'Misreads decisive intervention as protection.' },
        { label: 'Misreads silence after the event as evidence that order has been restored.' },
      ],
      color: '#7A5A8C',
    },
    {
      name: 'John Ellery',
      fullName: 'John Ellery',
      role: 'Thomas\'s father; late voice; plain speaker of the fact that breaks Jake\'s false story.',
      socialPosition: 'Grieving parent, physiotherapist or body-worker, outside the schoolboys\' emotional mythology.',
      contradiction: 'Carries devastating truth, speaks it without drama.',
      publicWant: 'Possibly no grand want; he responds to what he sees in front of him.',
      privateWant: 'That someone still living might be spared one falsehood.',
      hiddenNeed: 'Not resolution, but dignity.',
      greatestFear: 'Not central in the section; his fear has already happened.',
      falseBelief: 'He may believe truth usually arrives too late to matter.',
      wound: 'A son lost without justice.',
      voice: {
        sentenceLength: 'Plain, short to medium.',
        rhythm: 'Factual, professional, no ornament.',
        preferredWords: ['body','damage','muscle','joint','weight','cold','practical detail'],
        forbiddenWords: ['wisdom-figure tone','speechifying','therapeutic exposition','dramatic revelation monologue'],
        metaphorSources: ['Body and damage management.'],
        attentionPattern: 'Sees physical injury and the human cost beneath it.',
        howEmotionLeaks: 'Understatement, flatness, practical care.',
        sampleSentenceNeutral: 'His knee was not badly damaged. Boys fall worse than that every week. It was the way he looked past me that made me say it.',
      },
      arcPhases: ['One section only','Observation of injury or collision','Plain sentence','Withdrawal'],
      plotFunctions: [
        'Delivers the fact that breaks Jake\'s distortion.',
        'Does not explain the whole book.',
        'Allows truth to enter without melodrama.',
        'Exits before becoming a moral authority.',
      ],
      misreadings: [],
      color: '#4A5D5C',
    },
  ],
  motifs: [
    { name: 'Bells',           function: 'Order, obedience, time, institutional control.' },
    { name: 'Mud',             function: 'Physical truth, humiliation, football, class levelling, final contact.' },
    { name: 'Chapel ceiling',  function: 'Beauty, surveillance, refuge, dissociation.' },
    { name: 'Hands',           function: 'Touch, care, violence, desire, control, maternal adjustment, clinical damage.' },
    { name: 'Latin',           function: 'Precision, tradition, moral weight, failed translation.' },
    { name: 'Letters & notebooks', function: 'Delayed communication, privacy, exposure, failed disclosure.' },
  ],
  /* Scene seeds — same IDs as the project doc for cross-reference. */
  beats: [
    { label: 'S01', movement: 'I',   pov: 'Jake',   title: 'Jake arrives at St Cormac\'s.',
      outerEvent: 'Jake arrives at St Cormac\'s.',
      innerTurn: 'Inherited belonging is disturbed by first notice of Marcus.',
      timelinePoint: '1982 Michaelmas' },
    { label: 'S02', movement: 'I',   pov: 'Marcus', title: 'Marcus arrives with Diana.',
      outerEvent: 'Marcus arrives with Diana.',
      innerTurn: 'Hope becomes careful self-monitoring.',
      timelinePoint: '1982 Michaelmas' },
    { label: 'S03', movement: 'I',   pov: 'Thomas', title: 'Latin class introduces Odi et amo.',
      outerEvent: 'Latin class introduces Odi et amo.',
      innerTurn: 'Play becomes emotional code.',
      timelinePoint: '1983' },
    { label: 'S04', movement: 'I',   pov: 'Jake',   title: 'Jake chooses Marcus over a prefect.',
      outerEvent: 'Jake chooses Marcus over a prefect or higher-status boy.',
      innerTurn: 'Attachment acts before self-knowledge.',
      timelinePoint: '1983' },
    { label: 'S05', movement: 'I',   pov: 'Marcus', title: 'Marcus refracts Jake\'s choice.',
      outerEvent: 'Marcus retells or refracts Jake\'s choice.',
      innerTurn: 'Gratitude becomes dangerous hope.',
      timelinePoint: '1983' },
    { label: 'S06', movement: 'I',   pov: 'Thomas', title: 'Thomas observes Jake talking about Marcus.',
      outerEvent: 'Thomas observes Jake talking about Marcus without knowing what he reveals.',
      innerTurn: 'Thomas recognises what Jake cannot.',
      timelinePoint: '1983' },
    { label: 'S07', movement: 'II',  pov: 'Thomas', title: 'Declan\'s office through objects.',
      outerEvent: 'Declan\'s office scene, described only through objects.',
      innerTurn: 'Authority becomes dread.',
      timelinePoint: '1984',
      withholdingLevel: 'high', sceneFunctionType: 'withholding' },
    { label: 'S08', movement: 'II',  pov: 'Marcus', title: 'Marcus notices Thomas altered after chapel.',
      outerEvent: 'Marcus notices Thomas altered after chapel or class.',
      innerTurn: 'Vague unease becomes private responsibility.',
      timelinePoint: '1985 Autumn' },
    { label: 'S09', movement: 'II',  pov: 'Jake',   title: 'Jake notices Marcus noticing Thomas.',
      outerEvent: 'Jake notices Marcus noticing Thomas but interprets it wrongly.',
      innerTurn: 'Confusion becomes irritation or avoidance.',
      timelinePoint: '1985 Autumn' },
    { label: 'S10', movement: 'II',  pov: 'Diana',  title: 'Diana finds Marcus\'s notebook.',
      outerEvent: 'Diana finds Marcus\'s notebook or writing.',
      innerTurn: 'Tender concern becomes fear-driven interpretation.',
      timelinePoint: '1985 Christmas' },
    { label: 'S11', movement: 'II',  pov: 'Diana',  title: 'Diana visits Declan.',
      outerEvent: 'Diana visits or contacts Declan.',
      innerTurn: 'Protection becomes exposure.',
      timelinePoint: '1986 January' },
    { label: 'S12', movement: 'II',  pov: 'Thomas', title: 'Fragmented chapel ceiling / abandoned letter.',
      outerEvent: 'Fragmented chapel ceiling or abandoned letter.',
      innerTurn: 'Language fails and surfaces become refuge.',
      timelinePoint: '1986 January',
      withholdingLevel: 'high', sceneFunctionType: 'fragment' },
    { label: 'S13', movement: 'II',  pov: 'Marcus', title: 'Bathroom scene with Thomas.',
      outerEvent: 'Bathroom scene with Thomas.',
      innerTurn: 'Care becomes fatal mistranslation.',
      timelinePoint: '1986 February',
      withholdingLevel: 'high', sceneFunctionType: 'withholding' },
    { label: 'S14', movement: 'II',  pov: 'Jake',   title: 'Morning after Thomas\'s death — empty bed.',
      outerEvent: 'The morning after Thomas\'s death or the empty bed.',
      innerTurn: 'Shock becomes numbness and bodily retreat.',
      timelinePoint: '1986 February' },
    { label: 'S15', movement: 'II',  pov: 'Marcus', title: 'Funeral or institutional ritual.',
      outerEvent: 'Funeral or institutional ritual.',
      innerTurn: 'Suspicion becomes unbearable but unsayable knowledge.',
      timelinePoint: '1986 February' },
    { label: 'S16', movement: 'II',  pov: 'Diana',  title: 'Diana shapes or accepts the official story.',
      outerEvent: 'Diana participates in shaping or accepting the story.',
      innerTurn: 'Certainty becomes moral evasion.',
      timelinePoint: '1986 Spring' },
    { label: 'S17', movement: 'II',  pov: 'Marcus', title: 'Marcus is transferred to Alderton.',
      outerEvent: 'Marcus is transferred to Alderton.',
      innerTurn: 'Speechlessness becomes exile.',
      timelinePoint: '1986 Spring' },
    { label: 'S18', movement: 'III', pov: 'Marcus', title: 'Alderton rebuilding scene.',
      outerEvent: 'Alderton rebuilding scene.',
      innerTurn: 'Survival begins without resolution.',
      timelinePoint: '1986 Late' },
    { label: 'S19', movement: 'III', pov: 'Jake',   title: 'Jake\'s volatile year at St Cormac\'s.',
      outerEvent: 'Jake\'s volatile year at St Cormac\'s.',
      innerTurn: 'False story hardens into anger.',
      timelinePoint: '1986 Late' },
    { label: 'S20', movement: 'III', pov: 'Jake',   title: 'Cup final begins (alternating).',
      outerEvent: 'Cup final begins.',
      innerTurn: 'Bodies recognise what minds have distorted.',
      timelinePoint: '1987 Spring',
      sceneFunctionType: 'stretto' },
    { label: 'S21', movement: 'III', pov: 'John Ellery', title: 'Touchline collision; injury.',
      outerEvent: 'Collision or injury near touchline.',
      innerTurn: 'Practical care opens into plain truth.',
      timelinePoint: '1987 Spring' },
    { label: 'S22', movement: 'III', pov: 'Jake',   title: 'Jake absorbs John\'s sentence.',
      outerEvent: 'Jake absorbs John\'s sentence.',
      innerTurn: 'Anger collapses into recognition.',
      timelinePoint: '1987 Spring',
      sceneFunctionType: 'reframing' },
    { label: 'S23', movement: 'III', pov: 'Marcus', title: 'Marcus senses Jake has changed.',
      outerEvent: 'Marcus senses Jake has changed.',
      innerTurn: 'Defence becomes hope and fear.',
      timelinePoint: '1987 Spring' },
    { label: 'S24', movement: 'III', pov: 'Jake',   title: 'Jake crosses the mud and kisses Marcus.',
      outerEvent: 'Jake crosses the mud and kisses Marcus.',
      innerTurn: 'The unsaid becomes briefly public.',
      timelinePoint: '1987 Spring' },
    { label: 'S25', movement: 'III', pov: 'Thomas', title: 'Coda fragment from an unfinished letter.',
      outerEvent: 'Coda fragment from an unfinished letter.',
      innerTurn: 'The silenced voice returns without explanation.',
      timelinePoint: '1987 After',
      sceneFunctionType: 'fragment', withholdingLevel: 'high' },
  ],
}

export const storyCraftSeedService = {
  async importStCormacs(
    manuscriptId: string,
    userId: string,
    isAdmin: boolean = false
  ): Promise<SeedResult> {
    // Top-level access check — uses repo helper to mirror manuscript permissions.
    await storyCraftRepo._internal.assertManuscriptAccess(manuscriptId, userId, isAdmin, 'write')

    // Pull existing rows so we can de-dupe by name/label.
    const existing = await storyCraftRepo.getBundle(manuscriptId, userId, isAdmin)
    const existingCharNames = new Set(existing.characters.map(c => c.name.toLowerCase()))
    const existingMotifNames = new Set(existing.motifs.map(m => m.name.toLowerCase()))
    const existingBeatLabels = new Set(existing.beats.map(b => (b.label ?? '').toLowerCase()).filter(Boolean))

    const result: SeedResult = {
      characters: 0,
      motifs: 0,
      beats: 0,
      causalLinks: 0,
      skipped: { characters: 0, motifs: 0, beats: 0 },
    }

    // Map of seed name → DB id for cross-references.
    const charByName = new Map<string, Character>()
    for (const c of existing.characters) charByName.set(c.name.toLowerCase(), c)

    // ---- characters ----
    for (let i = 0; i < SEED.characters.length; i++) {
      const seed = SEED.characters[i]
      if (existingCharNames.has(seed.name.toLowerCase())) {
        result.skipped.characters++
        continue
      }
      const created = await storyCraftRepo.createCharacter(
        manuscriptId,
        userId,
        {
          name: seed.name,
          fullName: seed.fullName ?? null,
          role: seed.role ?? null,
          socialPosition: seed.socialPosition ?? null,
          contradiction: seed.contradiction ?? null,
          publicWant: seed.publicWant ?? null,
          privateWant: seed.privateWant ?? null,
          hiddenNeed: seed.hiddenNeed ?? null,
          greatestFear: seed.greatestFear ?? null,
          falseBelief: seed.falseBelief ?? null,
          wound: seed.wound ?? null,
          voice: seed.voice as any,
          arcPhases: seed.arcPhases ?? [],
          plotFunctions: seed.plotFunctions ?? [],
          color: seed.color ?? null,
          orderIndex: i,
        },
        isAdmin
      )
      charByName.set(seed.name.toLowerCase(), created)
      result.characters++

      for (const m of (seed.misreadings ?? [])) {
        await storyCraftRepo.createMisreading(created.id, userId, { label: m.label }, isAdmin)
      }
    }

    // ---- motifs ----
    for (let i = 0; i < SEED.motifs.length; i++) {
      const m = SEED.motifs[i]
      if (existingMotifNames.has(m.name.toLowerCase())) {
        result.skipped.motifs++
        continue
      }
      await storyCraftRepo.createMotif(manuscriptId, userId, { name: m.name, function: m.function, orderIndex: i }, isAdmin)
      result.motifs++
    }

    // ---- beats ----
    const beatByLabel = new Map<string, string>()  // label -> beat.id (for causal links)
    for (let i = 0; i < SEED.beats.length; i++) {
      const b = SEED.beats[i]
      const labelLower = (b.label ?? '').toLowerCase()
      if (labelLower && existingBeatLabels.has(labelLower)) {
        result.skipped.beats++
        continue
      }
      const pov = charByName.get(b.pov.toLowerCase())
      const created = await storyCraftRepo.createBeat(
        manuscriptId,
        userId,
        {
          povCharacterId: pov?.id ?? null,
          orderIndex: i,
          label: b.label ?? null,
          title: b.title ?? null,
          movement: b.movement ?? null,
          timelinePoint: b.timelinePoint ?? null,
          outerEvent: b.outerEvent ?? null,
          innerTurn: b.innerTurn ?? null,
          sceneFunctionType: (b as any).sceneFunctionType ?? null,
          withholdingLevel: (b as any).withholdingLevel ?? null,
        },
        isAdmin
      )
      if (b.label) beatByLabel.set(b.label.toLowerCase(), created.id)
      result.beats++
    }

    // ---- causal links: simple "therefore" chain across consecutive beats so the
    // plot view has visible structure out of the box. The user can refine.
    const sortedLabels = SEED.beats.map(b => b.label).filter(Boolean) as string[]
    for (let i = 0; i < sortedLabels.length - 1; i++) {
      const fromId = beatByLabel.get(sortedLabels[i].toLowerCase())
      const toId = beatByLabel.get(sortedLabels[i + 1].toLowerCase())
      if (!fromId || !toId) continue
      try {
        await storyCraftRepo.createCausalLink(
          manuscriptId,
          userId,
          { fromBeatId: fromId, toBeatId: toId, linkType: 'therefore', note: null },
          isAdmin
        )
        result.causalLinks++
      } catch {
        // If the link already exists, the unique constraint will trigger upsert
        // semantics in the repo; nothing to do.
      }
    }

    return result
  },
}
