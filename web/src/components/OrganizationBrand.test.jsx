import { render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

import { OrganizationBrand } from './OrganizationBrand.jsx';

afterEach(() => document.body.replaceChildren());

test('formal organization identity uses the approved KSP logo and product name', () => {
  render(<OrganizationBrand />);
  expect(screen.getByRole('img', { name: 'Karnataka State Police emblem' })).toHaveAttribute('src', '/brand/karnataka-state-police.webp');
  expect(screen.getByText('Karnataka State Police')).toBeInTheDocument();
  expect(screen.getByText('Analytics · Crime · Enforcement')).toBeInTheDocument();
});

test('compact organization identity uses the Karnataka seal with an accessible label', () => {
  render(<OrganizationBrand compact />);
  expect(screen.getByRole('img', { name: 'Karnataka State Police emblem' })).toHaveAttribute('src', '/brand/karnataka-seal.webp');
  expect(screen.getByText('KSP')).toBeInTheDocument();
});
