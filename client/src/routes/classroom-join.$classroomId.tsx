import React, { useState, useEffect } from 'react';
import { createFileRoute, useParams, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { getClassroomJoinStatus, submitClassroomJoinRequest } from '@/lib/api';

export const Route = createFileRoute('/classroom-join/$classroomId')({
  component: ClassroomJoin,
});

function ClassroomJoin() {
  const { classroomId } = Route.useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [previousStatus, setPreviousStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [savedEmail, setSavedEmail] = useState('');

  useEffect(() => {
    const checkRequestStatus = async () => {
      const email = localStorage.getItem(`classroom_join_email_${classroomId}`);
      if (!email) {
        setCheckingStatus(false);
        return;
      }
      setSavedEmail(email);
      try {
        const data = await getClassroomJoinStatus(classroomId, email);
        if (data.success) {
          setPreviousStatus(data.status);
          if (data.status === 'approved') {
            toast.success('Your request was approved! Redirecting to login...');
            setTimeout(() => {
              navigate({ to: '/login' });
            }, 1500);
          }
        }
      } catch (error) {
        console.error('Error checking join request status:', error);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkRequestStatus();
  }, [classroomId, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email || !formData.phone || !formData.password) {
      toast.error('All fields are required.');
      return;
    }
    
    setLoading(true);
    try {
      const data = await submitClassroomJoinRequest(classroomId, formData);
      if (data.success) {
        toast.success('Join request sent successfully!');
        localStorage.setItem(`classroom_join_email_${classroomId}`, formData.email);
        setSubmitted(true);
      } else {
        if (data.code === 'ALREADY_APPROVED' || (data.message && (data.message.includes('approved') || data.message.includes('login')))) {
          toast.success('Request already approved! Redirecting to login...');
          localStorage.setItem(`classroom_join_email_${classroomId}`, formData.email);
          setTimeout(() => {
            navigate({ to: '/login' });
          }, 1500);
        } else {
          toast.error(data.message || 'Failed to submit request.');
        }
      }
    } catch (error: any) {
      console.error('Submit join request error:', error);
      toast.error(error.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center px-4">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600 font-semibold">Checking request status...</p>
        </div>
      </div>
    );
  }

  if (previousStatus === 'approved') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center px-4">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600 font-semibold">Redirecting you to login page...</p>
        </div>
      </div>
    );
  }

  if (previousStatus === 'pending') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center border border-gray-100">
          <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Awaiting Approval</h2>
          <p className="text-gray-600 mb-6">
            You have already submitted a join request for this classroom under <span className="font-semibold text-gray-800">{savedEmail}</span>. Please wait for the admin to approve it.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate({ to: '/login' })}
              className="w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition shadow-sm"
            >
              Go to Login
            </button>
            <button
              onClick={() => {
                localStorage.removeItem(`classroom_join_email_${classroomId}`);
                setPreviousStatus('none');
              }}
              className="w-full bg-white text-gray-700 font-semibold py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Submit a new request
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Sent</h2>
          <p className="text-gray-600 mb-6">Your admission request has been sent to the admin. You will receive an email once approved.</p>
          <button
            onClick={() => navigate({ to: '/login' })}
            className="w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Join Classroom
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Fill in your details to request admission.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name</label>
              <div className="mt-1">
                <input
                  name="fullName"
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email address</label>
              <div className="mt-1">
                <input
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Mobile Number</label>
              <div className="mt-1">
                <input
                  name="phone"
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
