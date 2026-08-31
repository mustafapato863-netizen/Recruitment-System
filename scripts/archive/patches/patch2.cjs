const fs = require('fs');
let content = fs.readFileSync('InterviewDetailPage.tsx', 'utf8');

content = content.replace("import { Textarea } from '../components/ui/Textarea';", "import { Textarea } from '../components/ui/Textarea';\nimport { Scorecard, type Recommendation } from '../components/ui/Scorecard';");

const scorecardBadgeRegex = /<span className=\{\['px-2\.5 py-0\.5 rounded-full[^>]*>[\s\S]*?\{sc\.recommendation\}[\s\S]*?<\/span>/;
content = content.replace(scorecardBadgeRegex, '<StatusBadge status={sc.recommendation} />');

const formRegex = /\{\/\* Scorecard Submission Form \*\/\}\s*<section className="rf-panel rounded-2xl border border-rf-border-subtle bg-white p-5 shadow-xs">[\s\S]*?<\/section>/;
const formReplacement = `\{/* Scorecard Submission Form */\}
          <section className="rf-panel rounded-2xl border border-rf-border-subtle bg-white p-5 shadow-xs">
            <Scorecard
              title="Submit Competency Scorecard"
              interviewer="Interviewer"
              recommendation={recommendation as Recommendation}
              onRecommendationChange={(val) => setRecommendation(val)}
              categories={[{ id: 'overall', name: 'Overall Rating', rating }]}
              onRatingChange={(catId, newRating) => setRating(newRating)}
              onSubmit={(e) => void handleSubmitScorecard(e as any)}
              submitLabel="Submit evaluation scorecard"
            />
          </section>`;
content = content.replace(formRegex, formReplacement);

fs.writeFileSync('InterviewDetailPage.tsx', content, 'utf8');
