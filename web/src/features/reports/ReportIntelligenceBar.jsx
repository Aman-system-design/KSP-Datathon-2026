import { Sparkles } from 'lucide-react';
import { useState } from 'react';

export function ReportIntelligenceBar() {
  const [prompt, setPrompt] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function updatePrompt(event) {
    setPrompt(event.target.value);
    setSubmitted(false);
  }

  function submit() {
    if (!prompt.trim()) return;
    setSubmitted(true);
  }

  function submitOnEnter(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    submit();
  }

  return <section className="report-intelligence" aria-label="Report intelligence assistant">
    <div className="report-intelligence__bar">
      <Sparkles aria-hidden="true" size={17} />
      <input
        aria-label="Ask Intelligence"
        onChange={updatePrompt}
        onKeyDown={submitOnEnter}
        placeholder="What do you want to see?"
        value={prompt}
      />
      <button className="primary-button" disabled={!prompt.trim()} onClick={submit} type="button">Ask Intelligence</button>
    </div>
    {submitted ? <p className="report-intelligence__status" role="status">
      Intelligence setup is not enabled yet. Your report was not changed.
    </p> : null}
  </section>;
}
