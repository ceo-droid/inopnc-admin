import { useState, useEffect } from 'react';

export const useTheme = () => {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('theme') === 'dark' || !localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return { darkMode, toggleTheme };
};
