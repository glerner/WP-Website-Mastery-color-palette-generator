import React from 'react';
import { Link } from 'react-router-dom';
import { Palette } from 'lucide-react';
import styles from './Header.module.css';

export const Header = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <header className={styles.header}>
        <div className={styles.container}>
          <Link to="/" className={styles.logo}>
            <Palette size={24} color="var(--primary)" />
            <span className={styles.logoText}>GL Color</span>
          </Link>
          <nav className={styles.nav}>
            <Link to="/" className={styles.navLink}>
              Home
            </Link>
            <Link to="/generator" className={styles.navLink}>
              Generator
            </Link>
          </nav>
        </div>
      </header>
      <main className={styles.mainContent}>{children}</main>
    </>
  );
};