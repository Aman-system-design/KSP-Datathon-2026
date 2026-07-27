import { Sparkles } from 'lucide-react';
import { useState } from 'react';

export function ReportIntelligenceBar() {
  const [prompt, setPrompt] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function updatePrompt(event) {
    setPrompt(event.target.value);
    setSubmitted(false);
  }

  function submit(event) {
    event.preventDefault();
    if (!prompt.trim()) return;
    setSubmitted(true);
  }

  return <section className="report-intelligence" aria-label="Report intelligence assistant">
    <form className="report-intelligence__bar" onSubmit={submit}>
      <Sparkles aria-hidden="true" size={17} />
      <input
        aria-label="Ask Intelligence"
        onChange={updatePrompt}
        placeholder="What do you want to see?"
        value={prompt}
      />
      <button className="primary-button" disabled={!prompt.trim()} type="submit">Ask Intelligence</button>
    </form>
    {submitted ? <p className="report-intelligence__status" role="status">
      Intelligence setup is not enabled yet. Your report was not changed.
    </p> : null}
  </section>;
}
