import { Link } from 'react-router-dom'
import { FileText, Sparkles, UploadCloud, Target, BrainCircuit, Activity } from 'lucide-react'

export default function StudentDashboard() {
  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-fade-in py-8">
      {/* Header Area */}
      <div className="flex flex-col items-center text-center bg-gradient-to-br from-violet-50 to-fuchsia-50 rounded-3xl p-10 border border-violet-100 shadow-sm relative overflow-hidden">
        <Sparkles className="absolute top-6 left-10 w-8 h-8 text-violet-200" />
        <Sparkles className="absolute bottom-10 right-14 w-6 h-6 text-fuchsia-200" />
        
        <div className="bg-violet-100 text-violet-700 p-3 rounded-2xl mb-4">
          <BrainCircuit className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Resume Feedback Hub</h1>
        <p className="text-gray-600 max-w-lg mb-6">
          Focus entirely on improving your skills and how they are presented. Get instantaneous, AI-driven critique on your resume.
        </p>
        
        <button className="bg-violet-600 hover:bg-violet-700 text-white font-medium py-3 px-6 rounded-full inline-flex items-center gap-2 transition-all shadow-md hover:shadow-lg" onClick={() => alert("Resume uploading flow connects here.")}>
          <UploadCloud className="w-5 h-5" />
          Test My Resume Now
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col items-center text-center">
          <div className="bg-teal-50 p-3 rounded-full mb-3 text-teal-600">
            <Target className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-gray-900 text-lg">Skill Extraction</h3>
          <p className="text-gray-500 text-sm mt-2">See exactly which skills an ATS algorithm prioritizes from your document.</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col items-center text-center">
          <div className="bg-rose-50 p-3 rounded-full mb-3 text-rose-600">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-gray-900 text-lg">Formatting Critique</h3>
          <p className="text-gray-500 text-sm mt-2">Learn how effectively your structure highlights your core competencies.</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col items-center text-center">
          <div className="bg-amber-50 p-3 rounded-full mb-3 text-amber-600">
            <Activity className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-gray-900 text-lg">Growth Metrics</h3>
          <p className="text-gray-500 text-sm mt-2">Track the improvement of your resume score across iterations over time.</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Recent AI Analyses</h2>
          <span className="text-sm text-gray-500">Only you can see these</span>
        </div>
        
        <div className="border border-dashed border-gray-300 rounded-xl p-10 text-center bg-gray-50">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-600">No resumes analyzed yet.</p>
          <p className="text-sm text-gray-500 mt-1">Upload a resume to receive your first automated feedback report.</p>
        </div>
      </div>
    </div>
  )
}
