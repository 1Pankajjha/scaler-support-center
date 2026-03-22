export const colorPalette = [
  { name: 'Purple', color: '#7C3AED', gradient: 'linear-gradient(to right, #eaddf9, #f3e8ff)' },
  { name: 'Blue', color: '#2563EB', gradient: 'linear-gradient(to right, #dbeafe, #eff6ff)' },
  { name: 'Green', color: '#16A34A', gradient: 'linear-gradient(to right, #dcfce7, #f0fdf4)' },
  { name: 'Orange', color: '#EA580C', gradient: 'linear-gradient(to right, #ffedd5, #fff7ed)' },
  { name: 'Pink', color: '#DB2777', gradient: 'linear-gradient(to right, #fce7f3, #fdf2f8)' },
  { name: 'Indigo', color: '#4F46E5', gradient: 'linear-gradient(to right, #e0e7ff, #eef2ff)' }
];

export const assignThemeColor = (index, keyword = '') => {
  // Simple cyclic mapping based on index fallback
  const validIndex = Math.max(0, index % colorPalette.length);
  return colorPalette[validIndex];
};
