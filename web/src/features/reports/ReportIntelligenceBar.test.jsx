import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

import { ReportIntelligenceBar } from './ReportIntelligenceBar.jsx';

afterEach(cleanup);

test('keeps Ask disabled until a prompt contains text', () => {
  render(<ReportIntelligenceBar />);
  const ask = screen.getByRole('button', { name: 'Ask Intelligence' });
  expect(ask).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Ask Intelligence'), { target: { value: 'Show FIR count by hour' } });
  expect(ask).toBeEnabled();
});

test('answers honestly without calling a service or changing a report', () => {
  render(<ReportIntelligenceBar />);
  fireEvent.change(screen.getByLabelText('Ask Intelligence'), { target: { value: 'Show FIR count by hour' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ask Intelligence' }));
  expect(screen.getByRole('status')).toHaveTextContent('Intelligence setup is not enabled yet. Your report was not changed.');
});

test('editing the prompt collapses the previous deferred response', () => {
  render(<ReportIntelligenceBar />);
  const prompt = screen.getByLabelText('Ask Intelligence');
  fireEvent.change(prompt, { target: { value: 'Show FIR count by hour' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ask Intelligence' }));
  fireEvent.change(prompt, { target: { value: 'Show open FIR count' } });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
