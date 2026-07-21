import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { OrganizationBrand } from './OrganizationBrand.jsx';

test('formal organization identity uses the approved KSP logo and product name', () => {
  render(<OrganizationBrand />);
  expect(screen.getByRole('img', { name: 'Karnataka State Police emblem' })).toHaveAttribute('src', '/brand/ksp-logo.webp');
  expect(screen.getByText('KSP Crime Decision Intelligence')).toBeInTheDocument();
  expect(screen.getByText('Karnataka State Police')).toBeInTheDocument();
});

test('compact organization identity uses the Karnataka seal with an accessible label', () => {
  render(<OrganizationBrand compact />);
  expect(screen.getByRole('img', { name: 'Government of Karnataka seal' })).toHaveAttribute('src', '/brand/karnataka-seal.webp');
  expect(screen.getByText('KSP')).toBeInTheDocument();
});
