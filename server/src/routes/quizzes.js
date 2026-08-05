const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const User = require('../models/User');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Classroom = require('../models/Classroom');
const { protect, restrictTo, verifyClassroomAccess } = require('../middleware/auth');

const verifyClassroomAccessById = async (classroomId, user, writeRequired = false) => {
  if (!classroomId) return false;
  const classroom = await Classroom.findById(classroomId);
  if (!classroom) return false;
  return verifyClassroomAccess(classroom, user, writeRequired);
};

const verifyAttemptAccess = async (attempt, user) => {
  if (!attempt || !user) return false;
  // If the logged-in student owns this attempt, grant access immediately
  const studentId = attempt.student ? (attempt.student._id ? attempt.student._id.toString() : attempt.student.toString()) : '';
  if (studentId && studentId === user._id.toString()) return true;
  // Otherwise check classroom access
  const classroomId = attempt.quiz ? (attempt.quiz.classroom ? (attempt.quiz.classroom._id ? attempt.quiz.classroom._id.toString() : attempt.quiz.classroom.toString()) : null) : null;
  if (classroomId) {
    return verifyClassroomAccessById(classroomId, user, false);
  }
  return false;
};

const upload = multer({ storage: multer.memoryStorage() });

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 10000; // 10 seconds

// Helper function to sleep for a specified duration
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to calculate exponential backoff delay
const calculateRetryDelay = (retryCount) => {
  const delay = Math.min(
    INITIAL_RETRY_DELAY * Math.pow(2, retryCount),
    MAX_RETRY_DELAY
  );
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.3 * delay;
  return delay + jitter;
};

// Helper function to check if error is retryable
const isRetryableError = (error) => {
  const retryableStatuses = [429, 500, 502, 503, 504];
  const errorMessage = error.message || '';
  
  // Check for 503 Service Unavailable
  if (errorMessage.includes('503') || errorMessage.includes('Service Unavailable')) {
    return true;
  }
  
  // Check for rate limit errors
  if (errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
    return true;
  }
  
  // Check for network errors
  if (errorMessage.includes('ECONNRESET') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('ENOTFOUND')) {
    return true;
  }
  
  return false;
};

// Wrapper function to execute Gemini API calls with retry logic
const executeWithRetry = async (operation, operationName = 'Gemini API') => {
  let lastError;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on the last attempt
      if (attempt === MAX_RETRIES) {
        break;
      }
      
      // Check if error is retryable
      if (!isRetryableError(error)) {
        console.error(`[${operationName}] Non-retryable error:`, error.message);
        throw error;
      }
      
      // Calculate delay and wait
      const delay = calculateRetryDelay(attempt);
      console.warn(
        `[${operationName}] Attempt ${attempt + 1} failed with retryable error. ` +
        `Retrying in ${Math.round(delay)}ms... Error: ${error.message}`
      );
      
      await sleep(delay);
    }
  }
  
  // All retries exhausted
  console.error(`[${operationName}] All ${MAX_RETRIES + 1} attempts failed.`);
  throw lastError;
};


// Helper to shuffle an array (Fisher-Yates)
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// GET /classroom/:classroomId → Get all quizzes for a classroom
router.get('/classroom/:classroomId', protect, async (req, res, next) => {
  try {
    const classroom = await Classroom.findById(req.params.classroomId);
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }

    // Verify classroom access
    if (!verifyClassroomAccess(classroom, req.user, false)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    const isStaff = ['admin', 'superadmin', 'faculty'].includes(req.user.role);
    // Students only see published or closed quizzes. Admins/Faculty see all (draft, published, closed)
    const filter = { classroom: req.params.classroomId };
    if (!isStaff) {
      filter.status = { $in: ['published', 'closed'] };
    }

    // Project out correct options for students
    let quizzes = await Quiz.find(filter).sort({ createdAt: -1 });

    if (!isStaff) {
      quizzes = quizzes.map(quiz => {
        const qObj = quiz.toObject();
        qObj.questions = qObj.questions.map(q => {
          q.options = q.options.map(opt => {
            const { isCorrect, ...rest } = opt;
            return rest;
          });
          delete q.explanation;
          return q;
        });
        return qObj;
      });
    }

    res.json({ success: true, quizzes });
  } catch (error) {
    next(error);
  }
});

// GET /:id → Get quiz detail
router.get('/:id', protect, async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    const classroom = await Classroom.findById(quiz.classroom);
    if (!classroom || !verifyClassroomAccess(classroom, req.user, false)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    const isStaff = ['admin', 'superadmin', 'faculty'].includes(req.user.role);
    if (!isStaff && quiz.status === 'draft') {
      return res.status(403).json({ success: false, message: 'Quiz is not available yet' });
    }

    let quizResponse = quiz.toObject();
    // Hide correct answers and explanations for students
    if (!isStaff) {
      quizResponse.questions = quizResponse.questions.map(q => {
        q.options = q.options.map(opt => {
          const { isCorrect, ...rest } = opt;
          return rest;
        });
        delete q.explanation;
        return q;
      });
    }

    res.json({ success: true, quiz: quizResponse });
  } catch (error) {
    next(error);
  }
});

// POST /:id/attempt/start → Student: start quiz attempt
router.post('/:id/attempt/start', protect, async (req, res, next) => {
  try {
    const { id } = req.params;
    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    const classroom = await Classroom.findById(quiz.classroom);
    if (!classroom || !verifyClassroomAccess(classroom, req.user, false)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    if (quiz.status !== 'published') {
      return res.status(400).json({ success: false, message: 'This quiz is not open for attempts' });
    }

    // Check available dates
    const now = new Date();
    if (quiz.availableFrom && now < new Date(quiz.availableFrom)) {
      return res.status(400).json({ success: false, message: 'This quiz is not available yet' });
    }
    if (quiz.availableUntil && now > new Date(quiz.availableUntil)) {
      return res.status(400).json({ success: false, message: 'This quiz deadline has passed' });
    }

    // 1. Check if there is an active in_progress attempt for this student
    const activeAttempt = await QuizAttempt.findOne({ quiz: id, student: req.user._id, status: 'in_progress' });
    if (activeAttempt) {
      let questionsList = activeAttempt.questionOrder && activeAttempt.questionOrder.length > 0
        ? activeAttempt.questionOrder.map(qId => quiz.questions.find(q => q._id.toString() === qId.toString())).filter(Boolean)
        : quiz.questions;

      if (questionsList.length === 0) questionsList = quiz.questions;

      const sanitizedQuestions = questionsList.map(q => ({
        _id: q._id,
        type: q.type,
        text: q.text,
        image: q.image,
        marks: q.marks,
        options: (q.options || []).map(o => ({ label: o.label, text: o.text }))
      }));

      return res.json({
        success: true,
        isResumed: true,
        attempt: {
          _id: activeAttempt._id,
          startedAt: activeAttempt.startedAt,
          attemptNo: activeAttempt.attemptNo,
          duration: quiz.duration
        },
        questions: sanitizedQuestions
      });
    }

    // 2. Check attempt limits
    const submittedCount = await QuizAttempt.countDocuments({ quiz: id, student: req.user._id, status: 'submitted' });
    const maxAllowed = quiz.maxAttempts || 1;
    if (submittedCount >= maxAllowed) {
      const lastCompleted = await QuizAttempt.findOne({ quiz: id, student: req.user._id, status: 'submitted' }).sort({ attemptNo: -1 });
      return res.json({
        success: true,
        alreadySubmitted: true,
        attemptId: lastCompleted ? lastCompleted._id : null,
        message: 'You have already submitted this quiz.'
      });
    }

    // Snapshot question order for this student (apply randomization if enabled)
    let questionsList = [...quiz.questions];
    if (quiz.randomizeQuestions) {
      questionsList = shuffleArray(questionsList);
    }

    const questionOrder = questionsList.map(q => q._id);

    const attempt = await QuizAttempt.create({
      quiz: id,
      student: req.user._id,
      classroom: quiz.classroom,
      attemptNo: submittedCount + 1,
      status: 'in_progress',
      startedAt: new Date(),
      questionOrder,
      answers: []
    });

    // Strip answers and return questions
    const sanitizedQuestions = questionsList.map(q => {
      let optionsList = [...q.options];
      if (quiz.randomizeOptions && q.type !== 'true_false') {
        optionsList = shuffleArray(optionsList);
      }
      return {
        _id: q._id,
        type: q.type,
        text: q.text,
        image: q.image,
        marks: q.marks,
        options: optionsList.map(o => ({ label: o.label, text: o.text })) // omit isCorrect
      };
    });

    res.json({
      success: true,
      attempt: {
        _id: attempt._id,
        startedAt: attempt.startedAt,
        attemptNo: attempt.attemptNo,
        duration: quiz.duration
      },
      questions: sanitizedQuestions
    });
  } catch (error) {
    next(error);
  }
});

// PUT /:id/attempt/answer → Student: save/update answer during quiz
router.put('/:id/attempt/answer', protect, async (req, res, next) => {
  try {
    const { attemptId, questionId, selectedOptions, timeTakenSec } = req.body;
    const attempt = await QuizAttempt.findOne({ _id: attemptId, student: req.user._id }).populate('quiz');

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Active attempt not found' });
    }

    if (!(await verifyAttemptAccess(attempt, req.user))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    if (attempt.status !== 'in_progress') {
      return res.status(400).json({ success: false, message: 'Attempt has already been submitted' });
    }

    // Check if answer already exists
    const answerIndex = attempt.answers.findIndex(a => a.questionId.toString() === questionId.toString());
    if (answerIndex > -1) {
      attempt.answers[answerIndex].selectedOptions = selectedOptions;
      if (timeTakenSec !== undefined) {
        attempt.answers[answerIndex].timeTakenSec = timeTakenSec;
      }
    } else {
      attempt.answers.push({
        questionId,
        selectedOptions,
        timeTakenSec: timeTakenSec || 0
      });
    }

    await attempt.save();
    res.json({ success: true, message: 'Answer saved' });
  } catch (error) {
    next(error);
  }
});

// PUT /:id/attempt/answers → Student: save/update multiple answers in bulk
router.put('/:id/attempt/answers', protect, async (req, res, next) => {
  try {
    const { attemptId, answers } = req.body;
    if (!attemptId || !Array.isArray(answers)) {
      return res.status(400).json({ success: false, message: 'Invalid payload. attemptId and answers array are required.' });
    }

    const attempt = await QuizAttempt.findOne({ _id: attemptId, student: req.user._id }).populate('quiz');

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Active attempt not found' });
    }

    if (!(await verifyAttemptAccess(attempt, req.user))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    if (attempt.status !== 'in_progress') {
      return res.json({ success: true, message: 'Attempt has already been submitted' });
    }

    // Process each answer in the array
    if (!Array.isArray(attempt.answers)) attempt.answers = [];

    for (const ans of answers) {
      const { questionId, selectedOptions, timeTakenSec } = ans;
      if (!questionId) continue;
      
      const answerIndex = attempt.answers.findIndex(a => a.questionId && a.questionId.toString() === questionId.toString());
      if (answerIndex > -1) {
        attempt.answers[answerIndex].selectedOptions = Array.isArray(selectedOptions) ? selectedOptions : [];
        if (timeTakenSec !== undefined && typeof timeTakenSec === 'number') {
          attempt.answers[answerIndex].timeTakenSec = timeTakenSec;
        }
      } else {
        attempt.answers.push({
          questionId,
          selectedOptions: Array.isArray(selectedOptions) ? selectedOptions : [],
          timeTakenSec: (typeof timeTakenSec === 'number') ? timeTakenSec : 0
        });
      }
    }

    await attempt.save();
    res.json({ success: true, message: 'Answers saved successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /:id/attempt/submit → Student: submit quiz and auto-score
router.post('/:id/attempt/submit', protect, async (req, res, next) => {
  try {
    const { attemptId } = req.body;
    const attempt = await QuizAttempt.findOne({ _id: attemptId, student: req.user._id }).populate('quiz');

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Active attempt not found' });
    }

    if (!(await verifyAttemptAccess(attempt, req.user))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    if (attempt.status !== 'in_progress') {
      return res.json({
        success: true,
        message: 'Quiz already submitted',
        score: attempt.score || { rawMarks: 0, totalMarks: 100, percentage: 0, passed: false }
      });
    }

    const quiz = attempt.quiz;
    const gradedAnswers = [];
    let rawMarks = 0;

    const questionsList = Array.isArray(quiz?.questions) ? quiz.questions : [];

    for (const q of questionsList) {
      const qId = q._id ? q._id.toString() : '';
      const qMarks = (typeof q.marks === 'number' && !isNaN(q.marks)) ? q.marks : 1;

      // Find answer if student provided one
      const ans = (attempt.answers || []).find(a => a.questionId && a.questionId.toString() === qId);
      const selectedOptions = (ans && Array.isArray(ans.selectedOptions)) ? ans.selectedOptions : [];
      const timeTakenSec = (ans && typeof ans.timeTakenSec === 'number') ? ans.timeTakenSec : 0;

      const correctOptions = Array.isArray(q.options)
        ? q.options.filter(o => o.isCorrect).map(o => o.label)
        : [];

      const isCorrect = correctOptions.length > 0 &&
        selectedOptions.length === correctOptions.length &&
        selectedOptions.every(opt => correctOptions.includes(opt));

      let marksAwarded = 0;
      if (isCorrect) {
        marksAwarded = +qMarks;
        rawMarks += +qMarks;
      } else if (selectedOptions.length > 0 && quiz.negativeMarking) {
        const negValue = (typeof quiz.negativeMarkValue === 'number' && !isNaN(quiz.negativeMarkValue)) ? quiz.negativeMarkValue : 0;
        marksAwarded = -negValue;
        rawMarks -= negValue;
      }

      gradedAnswers.push({
        questionId: q._id,
        selectedOptions,
        isCorrect,
        marksAwarded,
        timeTakenSec
      });
    }

    attempt.answers = gradedAnswers;

    const calculatedTotalMarks = questionsList.reduce((sum, q) => sum + ((typeof q.marks === 'number' && !isNaN(q.marks)) ? q.marks : 1), 0);
    const totalMarks = (typeof quiz?.totalMarks === 'number' && !isNaN(quiz.totalMarks) && quiz.totalMarks > 0)
      ? quiz.totalMarks
      : (calculatedTotalMarks || 1);

    const safeRawMarks = isNaN(rawMarks) ? 0 : rawMarks;
    const finalMarks = Math.max(0, safeRawMarks);
    const percentage = Math.min(100, Math.max(0, Math.round((finalMarks / totalMarks) * 100)));
    const passPercent = (typeof quiz?.passPercent === 'number' && !isNaN(quiz.passPercent)) ? quiz.passPercent : 50;
    const passed = percentage >= passPercent;

    attempt.status = 'submitted';
    attempt.submittedAt = new Date();
    attempt.totalTimeTakenSec = Math.max(0, Math.round((attempt.submittedAt - (attempt.startedAt || new Date())) / 1000));
    attempt.score = {
      rawMarks: finalMarks,
      totalMarks,
      percentage,
      passed
    };

    await attempt.save();
    res.json({ success: true, message: 'Quiz submitted successfully', score: attempt.score });
  } catch (error) {
    next(error);
  }
});

// GET /:id/attempt/my-result → Student: get my own attempt result
router.get('/:id/attempt/my-result', protect, async (req, res, next) => {
  try {
    const { attemptId } = req.query;
    let attempt;
    if (attemptId) {
      attempt = await QuizAttempt.findOne({ _id: attemptId, student: req.user._id }).populate('quiz');
    } else {
      // get latest attempt
      attempt = await QuizAttempt.findOne({ quiz: req.params.id, student: req.user._id })
        .populate('quiz')
        .sort({ attemptNo: -1 });
    }

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt result not found' });
    }

    if (!(await verifyAttemptAccess(attempt, req.user))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    // Join options isCorrect and explanations to results
    const quiz = attempt.quiz;
    const answersWithExplanations = attempt.answers.map(ans => {
      const q = quiz.questions.find(quest => quest._id.toString() === ans.questionId.toString());
      return {
        questionId: ans.questionId,
        selectedOptions: ans.selectedOptions,
        isCorrect: ans.isCorrect,
        marksAwarded: ans.marksAwarded,
        timeTakenSec: ans.timeTakenSec,
        questionText: q ? q.text : '',
        explanation: q ? q.explanation : '',
        correctOptions: q ? q.options.filter(o => o.isCorrect).map(o => o.label) : [],
        options: q ? q.options.map(o => ({ label: o.label, text: o.text, isCorrect: o.isCorrect })) : []
      };
    });

    res.json({
      success: true,
      score: attempt.score,
      totalTimeTakenSec: attempt.totalTimeTakenSec,
      submittedAt: attempt.submittedAt,
      attemptNo: attempt.attemptNo,
      answers: answersWithExplanations
    });
  } catch (error) {
    next(error);
  }
});

// GET /:id/leaderboard → Get leaderboard if enabled or if user is admin/faculty
router.get('/:id/leaderboard', protect, async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    if (!(await verifyClassroomAccessById(quiz.classroom, req.user, false))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    const isStaff = ['admin', 'superadmin', 'faculty'].includes(req.user.role);
    if (!quiz.showLeaderboard && !isStaff) {
      return res.status(403).json({ success: false, message: 'Leaderboard is disabled for this quiz' });
    }

    // Get best attempt per student
    const attempts = await QuizAttempt.aggregate([
      { $match: { quiz: quiz._id, status: 'submitted' } },
      { $sort: { 'score.rawMarks': -1, submittedAt: 1 } },
      {
        $group: {
          _id: '$student',
          bestAttempt: { $first: '$$ROOT' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'studentInfo'
        }
      },
      { $unwind: '$studentInfo' },
      {
        $project: {
          studentName: '$studentInfo.fullName',
          avatar: '$studentInfo.avatar',
          score: '$bestAttempt.score.rawMarks',
          totalMarks: '$bestAttempt.score.totalMarks',
          percentage: '$bestAttempt.score.percentage',
          timeTaken: '$bestAttempt.submittedAt',
          attemptNo: '$bestAttempt.attemptNo'
        }
      },
      { $sort: { score: -1, percentage: -1 } }
    ]);

    res.json({ success: true, leaderboard: attempts });
  } catch (error) {
    next(error);
  }
});

// Admin and Faculty endpoints
router.use(protect);
router.use(restrictTo('admin', 'superadmin', 'faculty'));

// POST / → Admin: create quiz
router.post('/', async (req, res, next) => {
  try {
    const {
      classroom, title, instructions, availableFrom, availableUntil, duration,
      maxAttempts, randomizeQuestions, randomizeOptions, showLeaderboard,
      negativeMarking, negativeMarkValue, passPercent, questions, status
    } = req.body;

    if (!classroom || !title) {
      return res.status(400).json({ success: false, message: 'Classroom and title are required' });
    }

    if (!(await verifyClassroomAccessById(classroom, req.user, true))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    // Map question 'id' to '_id' for database compatibility
    let formattedQuestions = [];
    if (questions && Array.isArray(questions)) {
      formattedQuestions = questions.map(q => {
        const questionData = { ...q };
        if (q.id && mongoose.Types.ObjectId.isValid(q.id)) {
          questionData._id = q.id;
        } else {
          delete questionData._id;
        }
        return questionData;
      });
    }

    const quiz = await Quiz.create({
      classroom,
      title,
      instructions,
      createdBy: req.user._id,
      availableFrom,
      availableUntil,
      duration: duration || null,
      maxAttempts: maxAttempts || 1,
      randomizeQuestions: randomizeQuestions !== undefined ? randomizeQuestions : true,
      randomizeOptions: randomizeOptions !== undefined ? randomizeOptions : true,
      showLeaderboard: !!showLeaderboard,
      negativeMarking: !!negativeMarking,
      negativeMarkValue: negativeMarkValue || 0.25,
      passPercent: passPercent || 40,
      questions: formattedQuestions,
      status: status || 'draft'
    });

    // Increment quiz counts in classroom
    await Classroom.findByIdAndUpdate(classroom, {
      $inc: { 'stats.totalQuizzes': 1 }
    });

    res.status(201).json({ success: true, message: 'Quiz created successfully', quiz });
  } catch (error) {
    next(error);
  }
});

// PUT /:id → Admin: update quiz settings and questions
router.put('/:id', async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    if (!(await verifyClassroomAccessById(quiz.classroom, req.user, true))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    // Map question 'id' to '_id' for database compatibility
    if (req.body.questions && Array.isArray(req.body.questions)) {
      req.body.questions = req.body.questions.map(q => {
        const questionData = { ...q };
        if (q.id && mongoose.Types.ObjectId.isValid(q.id)) {
          questionData._id = q.id;
        } else {
          delete questionData._id;
        }
        return questionData;
      });
    }

    // Update settings
    const keys = [
      'title', 'instructions', 'availableFrom', 'availableUntil', 'duration',
      'maxAttempts', 'randomizeQuestions', 'randomizeOptions', 'showLeaderboard',
      'negativeMarking', 'negativeMarkValue', 'passPercent', 'questions', 'status'
    ];
    keys.forEach(k => {
      if (req.body[k] !== undefined) {
        quiz[k] = req.body[k];
      }
    });

    await quiz.save();
    res.json({ success: true, message: 'Quiz updated successfully', quiz });
  } catch (error) {
    next(error);
  }
});

// DELETE /:id → Admin: delete quiz
router.delete('/:id', async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    if (!(await verifyClassroomAccessById(quiz.classroom, req.user, true))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    await quiz.deleteOne();

    // Decrement quiz counts in classroom
    await Classroom.findByIdAndUpdate(quiz.classroom, {
      $inc: { 'stats.totalQuizzes': -1 }
    });

    res.json({ success: true, message: 'Quiz deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// PUT /:id/publish → Admin: publish quiz and notify
router.put('/:id/publish', async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    if (!(await verifyClassroomAccessById(quiz.classroom, req.user, true))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    quiz.status = 'published';
    quiz.notified = true;
    quiz.notifiedAt = new Date();
    await quiz.save();

    // Socket alert
    try {
      const { getIO } = require('../config/socket');
      const io = getIO();
      io.to(`classroom:${quiz.classroom}`).emit('quiz:published', {
        quizId: quiz._id,
        title: quiz.title,
        availableUntil: quiz.availableUntil
      });
    } catch (socketErr) {
      console.log('[Socket Error] Could not emit quiz published alert:', socketErr.message);
    }

    res.json({ success: true, message: 'Quiz published successfully. Students notified.' });
  } catch (error) {
    next(error);
  }
});

// PUT /:id/close → Admin: close quiz submissions
router.put('/:id/close', async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    if (!(await verifyClassroomAccessById(quiz.classroom, req.user, true))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    quiz.status = 'closed';
    await quiz.save();
    res.json({ success: true, message: 'Quiz submissions closed', quiz });
  } catch (error) {
    next(error);
  }
});

// GET /:id/report → Admin: get quiz mark report table
router.get('/:id/report', async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    if (!(await verifyClassroomAccessById(quiz.classroom, req.user, true))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    const attempts = await QuizAttempt.find({ quiz: req.params.id, status: 'submitted' })
      .populate('student', 'fullName email phone')
      .sort({ 'score.rawMarks': -1 });

    res.json({ success: true, attempts });
  } catch (error) {
    next(error);
  }
});

// GET /:id/report/export → Admin: CSV export template
router.get('/:id/report/export', async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    if (!(await verifyClassroomAccessById(quiz.classroom, req.user, true))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    const attempts = await QuizAttempt.find({ quiz: req.params.id, status: 'submitted' })
      .populate('student', 'fullName email');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=quiz-${req.params.id}-report.csv`);

    let csvContent = 'Student Name,Email,Attempt No,Raw Score,Total Marks,Percentage,Passed,Submitted Time\n';
    attempts.forEach(a => {
      const name = a.student.fullName;
      csvContent += `"${name}","${a.student.email}",${a.attemptNo},${a.score.rawMarks},${a.score.totalMarks},${a.score.percentage.toFixed(2)}%,${a.score.passed ? 'Yes' : 'No'},"${a.submittedAt.toISOString()}"\n`;
    });

    res.send(csvContent);
  } catch (error) {
    next(error);
  }
});

// GET /:id/analytics → Admin: question analytics (identify weak topics)
router.get('/:id/analytics', async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    if (!(await verifyClassroomAccessById(quiz.classroom, req.user, true))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    const attempts = await QuizAttempt.find({ quiz: req.params.id, status: 'submitted' });
    const totalAttempts = attempts.length;

    // Compile analytics per question
    const questionAnalytics = quiz.questions.map(q => {
      let wrongCount = 0;
      let correctCount = 0;
      let unansweredCount = 0;

      attempts.forEach(attempt => {
        const answer = attempt.answers.find(a => a.questionId.toString() === q._id.toString());
        if (!answer || answer.selectedOptions.length === 0) {
          unansweredCount++;
        } else if (answer.isCorrect) {
          correctCount++;
        } else {
          wrongCount++;
        }
      });

      const wrongRate = totalAttempts > 0 ? (wrongCount / totalAttempts) * 100 : 0;
      const correctRate = totalAttempts > 0 ? (correctCount / totalAttempts) * 100 : 0;

      return {
        questionId: q._id,
        text: q.text,
        type: q.type,
        correctCount,
        wrongCount,
        unansweredCount,
        correctRate,
        wrongRate
      };
    });

    res.json({
      success: true,
      totalAttempts,
      analytics: questionAnalytics
    });
  } catch (error) {
    next(error);
  }
});

// POST /generate-from-pdf → Admin: Generate quiz questions from PDF using Gemini
router.post('/generate-from-pdf', protect, restrictTo('admin', 'superadmin'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No PDF file uploaded' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ success: false, message: 'GEMINI_API_KEY is not configured on the server' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are an expert educational content extractor. I am providing a PDF document that contains quiz/exam questions.
The document might be in a regional language like Tamil or English.
Your task is to extract ALL the questions, options, and determine the correct answer based on your knowledge base.

Format your response exactly as a JSON array of objects, where each object matches this structure:
{
  "text": "The extracted question text",
  "type": "mcq", // or "msq" or "true_false"
  "marks": 1,
  "options": [
    { "label": "A", "text": "Option A text", "isCorrect": false },
    { "label": "B", "text": "Option B text", "isCorrect": true }
    // Add all options available
  ],
  "explanation": "A brief explanation of why the selected answer is correct (optional)"
}

Important:
- YOU MUST return ONLY the JSON array. Do not include markdown code blocks like \`\`\`json.
- YOU MUST automatically select the correct answer(s) by setting "isCorrect": true.
- If the language is Tamil, preserve the Tamil text exactly.`;

    // Execute with retry logic
    const response = await executeWithRetry(
      async () => {
        return await model.generateContent([
          prompt,
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: req.file.buffer.toString('base64')
            }
          }
        ]);
      },
      'Gemini PDF Generation'
    );

    let textResponse = response.response.text();
    // Strip markdown formatting if the model still includes it
    textResponse = textResponse.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();

    const questions = JSON.parse(textResponse);

    res.json({ success: true, questions });
  } catch (error) {
    console.error('PDF Generation Error:', error);
    
    // Provide user-friendly error messages
    if (error.message && error.message.includes('503')) {
      return res.status(503).json({ 
        success: false, 
        message: 'The AI service is currently experiencing high demand. Please try again in a few moments.' 
      });
    }
    
    if (error.message && error.message.includes('429')) {
      return res.status(429).json({ 
        success: false, 
        message: 'Too many requests. Please wait a moment and try again.' 
      });
    }
    
    next(error);
  }
});

module.exports = router;
