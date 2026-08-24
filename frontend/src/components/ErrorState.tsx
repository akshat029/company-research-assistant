import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, ServerCrash, Terminal, WifiOff } from 'lucide-react';
import { Card } from './ui/primitives';

interface Props {
  error: string;
  onRetry: () => void;
}

/**
 * Maps the failure to something the user can actually act on.
 *
 * Every one of these hints corresponds to a real failure hit while building
 * this project, so the UI now teaches the fix instead of just printing a stack.
 */
function diagnose(error: string) {
  const e = error.toLowerCase();

  // A missing dependency is the single most actionable failure there is: the
  // exact package name is right there in the message, so print the exact
  // command. Falling through to the generic branch here wasted a real run.
  if (e.includes('no module named') || e.includes('modulenotfounderror')) {
    const match = error.match(/no module named ['"]?([\w.]+)/i);
    const pkg = (match?.[1] ?? '').replace(/_/g, '-');
    return {
      icon: Terminal,
      tone: 'text-accent-amber',
      title: pkg ? `The backend is missing ${pkg}` : 'A Python package is missing',
      steps: [
        'Open a terminal in the backend folder',
        'Activate the venv: venv\\Scripts\\activate',
        pkg ? `Install it: pip install ${pkg}` : 'Install the missing package',
        'Safest: pip install -r requirements.txt',
        'Restart uvicorn, then retry',
      ],
    };
  }

  // Groq's Llama tool parser intermittently emits <function=web_search {...}>
  // where the API expects <function=web_search>{...}, and rejects the request
  // before a single search has run. GATHER_MODE=direct takes the model out of
  // the retrieval path entirely, so the failure cannot recur.
  if (
    e.includes('tool call validation failed') ||
    e.includes('tool_use_failed') ||
    e.includes('failed_generation')
  ) {
    return {
      icon: ServerCrash,
      tone: 'text-accent-amber',
      title: 'The model garbled a tool call',
      steps: [
        'A provider-side syntax bug, not a problem with your query',
        'Open backend/.env and set GATHER_MODE=direct',
        'That runs the searches from Python, with no tool calling at all',
        'Restart uvicorn, then retry',
      ],
    };
  }

  if (e.includes('cannot reach') || e.includes('network') || e.includes('port 8000')) {
    return {
      icon: WifiOff,
      tone: 'text-accent-amber',
      title: 'The backend is not reachable',
      steps: [
        'Open a terminal in the backend folder',
        'Activate the venv: venv\\Scripts\\activate',
        'Run: python -m uvicorn app.main:app --reload --port 8000',
        'Confirm http://localhost:8000/api/v1/health returns ok',
      ],
    };
  }

  if (e.includes('timed out') || e.includes('timeout')) {
    return {
      icon: AlertTriangle,
      tone: 'text-accent-amber',
      title: 'The research run took too long',
      steps: [
        'Retry at “quick” depth — it uses far fewer tool calls',
        'A slow or rate-limited LLM provider is the usual cause',
      ],
    };
  }

  if (e.includes('rate limit') || e.includes('429') || e.includes('tokens per minute')) {
    return {
      icon: ServerCrash,
      tone: 'text-accent-rose',
      title: 'The model provider rate-limited the request',
      steps: [
        'Free Groq tiers reset per minute — wait 60 seconds',
        'Use llama-3.3-70b-versatile (12k TPM) rather than the 8b model (6k TPM)',
        'Or lower the depth to reduce tokens per run',
      ],
    };
  }

  if (e.includes('api key') || e.includes('401') || e.includes('authentication')) {
    return {
      icon: ServerCrash,
      tone: 'text-accent-rose',
      title: 'The API key was rejected',
      steps: [
        'Check backend/.env holds real keys, not the .env.example placeholders',
        'TAVILY_API_KEY and the key for your LLM_PROVIDER must both be set',
        'Restart uvicorn after editing .env',
      ],
    };
  }

  return {
    icon: AlertTriangle,
    tone: 'text-accent-rose',
    title: 'Research failed',
    steps: ['Retry the request', 'Check the uvicorn console for the full traceback'],
  };
}

export function ErrorState({ error, onRetry }: Props) {
  const { icon: Icon, tone, title, steps } = diagnose(error);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-2xl"
    >
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] ring-1 ring-inset ring-white/10">
            <Icon className={`h-5 w-5 ${tone}`} />
          </span>

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-100">{title}</h3>
            <p className="mt-1 break-words text-sm text-slate-400">{error}</p>

            <div className="mt-4 rounded-xl border border-white/[0.07] bg-black/25 p-4">
              <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500">
                <Terminal className="h-3 w-3" />
                Try this
              </div>
              <ol className="space-y-1.5">
                {steps.map((step, i) => (
                  <li key={step} className="flex gap-2.5 text-sm text-slate-300">
                    <span className="select-none font-mono text-xs text-slate-600">{i + 1}.</span>
                    <span className="min-w-0 break-words">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent-indigo to-accent-violet px-4 py-2 text-sm font-semibold text-white transition-shadow hover:shadow-glow-lg"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
