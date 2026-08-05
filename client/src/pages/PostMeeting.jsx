import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

const PostMeeting = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  return (
    <div className="min-h-screen bg-[#f7f9fa] flex flex-col justify-center items-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Meeting Ended</h2>
        <p className="text-gray-600 mb-8">
          The meeting session has been closed.
        </p>

        {user?.role === 'teacher' && (
          <div className="bg-gray-50 rounded-lg p-4 mb-8 text-left border border-gray-200">
             <h3 className="font-semibold text-gray-800 mb-2">Host Options</h3>
             <ul className="text-sm space-y-2 text-gray-600">
               <li>• Export Attendance CSV (Coming Phase 5)</li>
               <li>• View Chat Logs</li>
             </ul>
          </div>
        )}

        <button
          onClick={() => navigate('/')}
          className="w-full bg-[#0B5CFF] text-white rounded-lg py-2 hover:bg-blue-700 transition"
        >
          Return to Home
        </button>
      </div>
    </div>
  );
};

export default PostMeeting;
