import { motion } from 'framer-motion';

interface AIAnalysisProps {
  aiExplanationText: string;
  onReturn?: () => void;
}

export default function AIAnalysis({ aiExplanationText, onReturn }: Readonly<AIAnalysisProps>) {
  return (
    <motion.div 
      className="ai-analysis-box"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
    >
      <div className="ai-analysis-header">
        <h2>A.I. Analysis</h2>
        {onReturn && (
          <button className="pokedex-back-button ai-analysis-back" onClick={onReturn} aria-label="Return to search">← Back</button>
        )}
      </div>
      <div className="ai-analysis-content">
        <p>{aiExplanationText}</p>
      </div>
    </motion.div>
  );
}
