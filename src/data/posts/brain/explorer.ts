export interface BrainScanFact {
  label: string;
  value: string;
  note: string;
}

export interface BrainStructureSide {
  label: string;
  src: string;
  alt: string;
  atlasMm3: number;
  freesurferMm3: number;
}

export interface BrainStructureSpotlightItem {
  id: string;
  title: string;
  hook: string;
  description: string;
  whyItMattered: string;
  sides: [BrainStructureSide, BrainStructureSide];
}

const totalVoxels = 224 * 320 * 320;

export const brainScanFacts: BrainScanFact[] = [
  {
    label: 'Field strength',
    value: '7 Tesla',
    note: 'Around twice the strength of a hospital scanner.',
  },
  {
    label: 'Sequence',
    value: 'MP2RAGE',
    note: 'This pulse sequence provides good contrast for brain anatomy.',
  },
  {
    label: 'Voxel size',
    value: '0.75 mm isotropic',
    note: 'A voxel = a 3D pixel.',
  },
  {
    label: 'Grid dimensions',
    value: '224 × 320 × 320',
    note: 'The raw file is a 3D block rather than a single image.',
  },
  {
    label: 'Total sampled voxels',
    value: `${(totalVoxels / 1_000_000).toFixed(1)} million`,
    note: 'This includes my skull, eyes and neck.',
  },
  {
    label: 'Approximate field of view',
    value: '168 × 240 × 240 mm',
    note: 'The physical size of the captured data.',
  },
];

export const brainStructureSpotlights: BrainStructureSpotlightItem[] = [
  {
    id: 'thalamus',
    title: 'Thalamus',
    hook: 'The first structure that really made the scan feel organised.',
    description:
      'The thalamus sits near the middle of the brain, acting as a relay station for huge amounts of sensory information. Once it was labelled, the rest of the deep anatomy became much easier to orient around.',
    whyItMattered:
      'It is large enough to see clearly, central enough to anchor the rest of the scan, and different enough across methods to reveal how much segmentation depends on modelling choices.',
    sides: [
      {
        label: 'Left',
        src: '/posts/brain/regions/004_Left_Thalamus.png',
        alt: 'Atlas-based snapshot of the left thalamus.',
        atlasMm3: 13533.75,
        freesurferMm3: 5793.4,
      },
      {
        label: 'Right',
        src: '/posts/brain/regions/015_Right_Thalamus.png',
        alt: 'Atlas-based snapshot of the right thalamus.',
        atlasMm3: 11720.953125,
        freesurferMm3: 6089.2,
      },
    ],
  },
  {
    id: 'hippocampus',
    title: 'Hippocampus',
    hook: 'The most famous deep structure, and one of the easiest to over-romanticise.',
    description:
      'The hippocampus is small, curved and tucked into the medial temporal lobe. It is strongly associated with memory, which makes it irresistible to point at, but in the scan it mostly taught me how subtle the boundaries of a real structure can be.',
    whyItMattered:
      'This was where the exploration stopped feeling like “find the obvious big blob” and started feeling like careful interpretation.',
    sides: [
      {
        label: 'Left',
        src: '/posts/brain/regions/009_Left_Hippocampus.png',
        alt: 'Atlas-based snapshot of the left hippocampus.',
        atlasMm3: 6381.703125,
        freesurferMm3: 1054.5,
      },
      {
        label: 'Right',
        src: '/posts/brain/regions/019_Right_Hippocampus.png',
        alt: 'Atlas-based snapshot of the right hippocampus.',
        atlasMm3: 6954.1875,
        freesurferMm3: 2591.6,
      },
    ],
  },
  {
    id: 'amygdala',
    title: 'Amygdala',
    hook: 'Small, famous, and annoyingly ambiguous.',
    description:
      'The amygdala sits just in front of the hippocampus and has acquired a huge cultural reputation as the “emotion” structure. In the MRI, though, it was mostly a lesson in humility: small structures are where a lot of the certainty evaporates.',
    whyItMattered:
      'If the thalamus shows how nicely a structure can emerge from the data, the amygdala shows where the software is doing a lot more inferential work.',
    sides: [
      {
        label: 'Left',
        src: '/posts/brain/regions/010_Left_Amygdala.png',
        alt: 'Atlas-based snapshot of the left amygdala.',
        atlasMm3: 2851.453125,
        freesurferMm3: 457.3,
      },
      {
        label: 'Right',
        src: '/posts/brain/regions/020_Right_Amygdala.png',
        alt: 'Atlas-based snapshot of the right amygdala.',
        atlasMm3: 3577.921875,
        freesurferMm3: 669.7,
      },
    ],
  },
];
