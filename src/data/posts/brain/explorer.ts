export interface BrainScanFact {
  label: string;
  value: string;
  note: string;
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

