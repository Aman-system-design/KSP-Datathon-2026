import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { BrandProvider } from '../../branding/BrandProvider.jsx';
import { CommandCenterShell } from './CommandCenterShell.jsx';
afterEach(() => { cleanup(); localStorage.clear(); });
const renderShell = () => render(<BrandProvider><CommandCenterShell /></BrandProvider>);
test('renders reference shell with empty canvas', () => { renderShell(); expect(screen.getByText('Karnataka State Police')).toBeInTheDocument(); expect(screen.getByRole('searchbox', { name: 'Search' })).toBeDisabled(); expect(screen.getByTestId('command-center-canvas')).toBeEmptyDOMElement(); });
test('changes only rail selection', () => { renderShell(); const map = screen.getByRole('button', { name: 'Map' }); fireEvent.click(map); expect(map).toHaveAttribute('aria-current', 'page'); expect(screen.getByTestId('command-center-canvas')).toBeEmptyDOMElement(); });
test('persists dark appearance', () => { renderShell(); fireEvent.click(screen.getByRole('button', { name: 'Open account menu' })); fireEvent.click(screen.getByRole('radio', { name: 'Dark' })); expect(screen.getByRole('application')).toHaveAttribute('data-appearance', 'dark'); expect(localStorage.getItem('ksp-command-center-appearance')).toBe('dark'); });
