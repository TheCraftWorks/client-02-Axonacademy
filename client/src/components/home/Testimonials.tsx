import { Quote, Play, Star, X, Plus, Loader2, CheckCircle2, AlertCircle, Upload } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { api, getAssetUrl } from "@/lib/api";

// Derive the base server URL (without /api/v1) so we can build stream URLs
const API_BASE = (() => {
  const runtime =
    import.meta.env.VITE_API_URL ||
    import.meta.env.BACKEND_URL ||
    (typeof process !== 'undefined' ? process.env.VITE_API_URL || process.env.BACKEND_URL : '');
  const base = (runtime?.trim() || '/api/v1').replace(/\/+$/,'');
  return base;
})();

const STUDENT_FEEDBACKS_ROW1 = [
  {
    name: "RANJITH KUMAR S",
    roll: "AXP26164",
    review: "Axon Med Academy has been a great support for my preparation! The video lectures are very useful, and the pnemonics  make difficult concepts much easier to remember. The weekend discussion classes are informative, and the staff are very friendly and supportive.The weekly tests are really helpful to track our progress and identify areas that need improvement.",
    initials: "RK",
  },
  {
    name: "RAJA SANKARI",
    roll: "AXP2615",
    review: "I am very happy with the guidance and support provided by Axon med academy. The pneumonics, regular tests, discussion classes, and revision sessions are very helpful in improving my understanding and progress.\n\nThe practice of posting questions regularly keeps us engaged and helps us revise important topics frequently.\n\nThe faculties are very supportive, approachable, and encouraging.\n\nOverall, it is a great learning environment with excellent teaching methods and consistent support. I am truly grateful to all the faculties and the academy for helping me progress in my studies.",
    initials: "RS",
  },
  {
    name: "G. Naveena",
    roll: "AXP2622",
    review: "My experience at Axon Med Academy has been really good. The teaching is clear and easy to understand. The faculty are supportive, approachable, and always willing  to clarify doubts.\n\nThe academy provides a positive learning environment and helps students stay focused and confident in their preparation. The study materials, guidance, and regular support are also very helpful.\n\nI’m grateful to the entire Axon Med Academy team for their continuous support and guidance.🌟📚",
    initials: "GN",
  },
  {
    name: "HARINI.L",
    roll: "AXP8269",
    review: "It's the only academy that doesn't focus on payment it focuses only on the way to make each and every one  success, cares individual, efforts to level up all the range of students wheather they are slow learner or smart one ,this academy only focus to level up each and every one.\n\nClasses and pneumonics are good apart from that telegram that created and maintained by the academy was the best one, it contains a lot and alot of questions with different aspects covering almost all the possible ways.\n\nI am very grateful to this academy and to the staffs.",
    initials: "HL",
  },
  {
    name: "P. Elakkiya",
    roll: "AXP26137",
    review: "I’m really happy that I joined Axon Academy. The Telegram question support, recorded classes, regular tests, and sufficient time for completing the tests are really helpful for our preparation.\n\nThe teaching and guidance are very friendly and supportive. We can ask even small doubts without hesitation, and every doubt is patiently cleared with proper explanation. The interaction feels more like a senior guiding juniors, which makes the learning environment very comfortable.\n\nOverall, I’m really satisfied with the support and guidance provided by the academy. Happy to be a part of Axon Academy! Thank you sir",
    initials: "PE",
  },
  {
    name: "Swathini",
    roll: "AXP26120",
    review: "I'm really grateful for choosing axon academy. You are helping me in being consistent and being confident. Recorded videos are very helpful in a way whenever we can study about particular subject. Telegram quizes are motivating us to keep in touch with the subject and tests also. Thank you sir",
    initials: "SW",
  },
  {
    name: "ABHISHEK SUMAN .G.P.S.",
    roll: "AXP26111",
    review: "I am really happy that I have joined really worthy institute to prepare for AIAPGET and MRB exams.\n\nThe faculty members really giving excellent clue that is very important for keep in memory vast subjects.\n\nThis institute engage me all time, that is very useful for me. I am very thankful for all the staffs, thank you.",
    initials: "AS",
  },
  {
    name: "Axon Aspirant",
    roll: "AIAPGET / MRB Batch",
    review: "I am very happy with my experience at Axon Academy. The clues and Telegram questions are very useful for improving our knowledge and exam preparation. They help us revise important topics regularly. The regular tests are also very helpful because they improve our confidence, time management, and exam performance.",
    initials: "AA",
  },
  {
    name: "SAKTHI SHANMUGI P",
    roll: "AXP2644",
    review: "Good evening sir,\nBefore joining this academy, I barely know about what is pg neet and how would be the syllabus. But after joining this academy, I got my full clarity on what is pg neet and how would be the question pattern. I got more clarity about my preparation schedule. Posting questions on Telegram and attending them makes me familiar and confidence over the subject. Attending our weekly test, discussion class gives me the pattern of pg neet and also helps me to correct my mistakes.\n\nI am really thankful that you gave us a restart test option which is very useful for us. Thank you sir for providing us this much guidance🙏🏻",
    initials: "SS",
  },
  {
    name: "D. Divya",
    roll: "AXP2678",
    review: "I’m really thankful to Axon Med Academy for their excellent guidance and support. The teaching is clear, systematic, and easy to understand. The study materials and regular guidance have been very helpful for my preparation. The faculty are supportive, motivating, and always ready to clarify doubts.\n\nThank you for helping me stay confident and focused throughout my preparation.",
    initials: "DD",
  },
  {
    name: "SANGAVI P",
    roll: "AX2659",
    review: "I am truly grateful to you for providing us with the restart test option, which has been very useful for our preparation and revision. Thank you so much, sir, for your continuous guidance, support, and for helping us prepare with more clarity and confidence. 🙏🏻",
    initials: "SP",
  },
  {
    name: "Aarthi R",
    roll: "AXP2611",
    review: "I am very much grateful for sharing my own feedback about axon academy. Its my pleasure to share that my preparations were incomplete without manikandan sir's guidance, the way they guide - the vedios, revision test , questions Posting was very much useful for my preparations. Thank you guiding us through this journey.",
    initials: "AR",
  },
  {
    name: "SUBHA .M",
    roll: "AXP26127",
    review: "In axon academy What I feel the most is the friendly environment which gives stress free study space with kind faculties always encouraging us to take our path in a right way at right time....The recorded classes are very useful for the prep that we can access it any time we want...The questions that we post are that much valuable for our preparation that we get experience and multiple diverse ways of approaching a topic to study....It feels like home that we can ask any doubt at any time explain our difficulties and get clarifications at the time of need...Now it's our duty to utilise all these options and put efforts to reach our goal...Sure sir we ll do our best...Thank you sir...",
    initials: "SM",
  },
  {
    name: "D. Devadharshini",
    roll: "AXP26110",
    review: "Good evening sir,\nIm most thankfull for being a part of axon academy sir,\n\nThe telegram qn sections practiced me to face the difference types of qns and also it boost me to create and think in different angles of qn ..\n\nAfter attending the discussion class i came to know the others perspectives of learning of same topics,.. It was very very usefull to me..\nAnd i request that pls make the discussion class by discussing(weeeknd test papers)not only the reason fo right option and also make clarification why others were wrong..\nAnd the vdo lectures are very usefull with easy pnemonics.\nThank you,",
    initials: "DD",
  },
  {
    name: "S. Sindhiya",
    roll: "AXP26123",
    review: "Firstly, the recorded videos are very helpful for me because whenever I want I can easily access the videos and the mnemonics make the subject easier. The test which is conducted regularly keeps me engaged and makes me to study even when I am lazy and the test results motivates me to study harder and identify my mistakes. The telegram group is also very helpful in revising the studied portions.\n\nThank you sir for the restart test option and I am making use of it .",
    initials: "SS",
  },
];

const STUDENT_FEEDBACKS_ROW2 = [
  {
    name: "Elakkiya.G",
    roll: "AXP26114",
    review: "Vedios in axon academy are very useful because we can go through it at any tym ..the mnemonics are very useful makes to remember points easily.\n\nThe telegram group is very useful we can solve questions of the topics we study and we do make questions so we learn topics clearly.\n\nExams helps to understand progress and we can write exam at any time if we unable to write at the time.\n\nThank u so much sir!",
    initials: "EG",
  },
  {
    name: "ABIVARTHINI.R",
    roll: "AXP2612",
    review: "I'm really glad that i have joined in this academy ☺️\nWithout any idea i just attended your orientation program at first and then i got clear idea for exam preparation. Through your guidance and support many of our seniors got MD seat which make more confident that i can also get MD. The regular revision and exam-focused practice helped me to identify my weaknesses, work on them .Eventhough i wasn't able study during the internship period you motivate me to study and not to quit any test.\n\nThe telegram qns poll make me easier to revise the portion and By everyother's qns i get different possibilities . The Restart test series is very helpful,through this i'm able to cover my missed syllabus.\n\nThe mnemonics and AI generated photos make me to learn easily and … I would like to sincerely thank axon med academy for providing such a valuable guidance and support.\n\nThe easy mnemonics for difficult concepts make learning much simpler and help us remember important topics easily and the weekend discussion classes provide a great opportunity to clarify our doubt and understand concepts better. Thank you sir for your continuous guidance , motivation, support. It has made our preparation easier and more effective..",
    initials: "AR",
  },
  {
    name: "Rasika R",
    roll: "AXP26135",
    review: "My experience with Axon Med Academy has been excellent . The video lectures and teaching methods are really good, and the pnemonics and formulas provided by the faculty make it much easier to understand, remember, and revise difficult topics. The regular tests conducted by the academy are extremely helpful in tracking our progress and identifying areas where we need to improve. Overall, the video lectures, regular tests, pnemonics, formulas, and discussion sessions make my PG preparation more effective. I am really happy to be a part of Axon Med Academy and grateful for the continuous support and guidance!\n\nThank Youuu sir!!!💫",
    initials: "RR",
  },
  {
    name: "S. Harini",
    roll: "AXP2610",
    review: "I am very grateful to Axon med academy . This academy teaches and guide us in a proper and easy way to reach our goal. I am thankful to Manikandan sir and all facilities who teaches us . They monitoring every single student regularly . Manikandan sir talk us with a friendly manner so we can ask doubt without fear at any time. Daily question posting and weekly exams are very useful for us . This academy helps us to focusesd our goals and thank you sir for your full support and guidance",
    initials: "SH",
  },
  {
    name: "Madhumitha.M",
    roll: "AXP2613",
    review: "I truly feel lucky to be a student of Axon Academy, where they not only focus on money but also genuinely care about each student’s future and keep motivating us every day.\n\nThe Telegram questions are very useful for revising the topics, and the recorded classes are especially convenient during my internship. Their unique study methods and mnemonics make even the harder topics much simpler and easier to understand.\n\nThank you so much, sir, for your constant guidance, motivation, and support.",
    initials: "MM",
  },
  {
    name: "Rajalakshmi S",
    roll: "AXP26112",
    review: "I personally find the recorded videos in Axon Academy very helpful because I can go back and watch them anytime, especially when I need to revise a topic or clarify something. The mnemonics are one of the things I really like because they make even lengthy topics easier to remember, and they are catchy.\n\nI also feel that the syllabus is covered in a way that makes it easier for me to study . The consistent tests are really useful in helping me check my understanding.\n\nThe Telegram group and DC sessions have also been very helpful . The faculties are approachable whenever I have doubts or need guidance.\n\nI genuinely like the learning environment in Axon Academy. It feels encouraging, supportive, and friendly, which makes me feel comfortable asking questions and continuing to learn with confidence.",
    initials: "RS",
  },
  {
    name: "RAGUL",
    roll: "AXP2658",
    review: "I am really satisfied with the way the academy conducts regular examinations, revision sessions, and discussion classes. The frequent exams help us assess our preparation, identify our weak areas, and improve our performance consistently. The revision classes are well-structured and help us retain important concepts, while the discussion sessions provide a clear understanding of difficult topics and clarify our doubts effectively.\n\nThe guidance and continuous support from the faculty motivate us to stay focused and prepare with confidence. Overall, the academy provides a disciplined and exam-oriented learning environment that is very helpful for achieving our goals. I truly appreciate the efforts of the entire faculty and management.",
    initials: "RG",
  },
  {
    name: "GOKULA DEEPIKA",
    roll: "AXP2652",
    review: "I like Axon Med Academy's video lectures cuz those pnemonics are helping me very much to memorize the syllabus. Weekly test, Telegram quiz bot are useful to monitor our progress. Your sincerity is making us to be consistent. Thankyou so much sir.",
    initials: "GD",
  },
  {
    name: "Raghavendra Ramanan",
    roll: "AXP2690",
    review: "Honestly, attending these sessions has been super helpful for my prep right now.\n\nA big, special thanks to Dr. Manikandan Sir. The way he teaches makes even the toughest topics feel so easy to understand. He explains everything so clearly and keeps us motivated throughout the class.\n\nReally grateful to Sir and the Axon team for such great guidance during this ongoing batch.",
    initials: "RR",
  },
  {
    name: "Nandhakumar K",
    roll: "AXP2607",
    review: "The recorded videos guide me to study each subject in the right way, and the mnemonics are always one of the best features of this academy. In fact, they encourage me to create my own mnemonics, which makes it easier to memorize difficult topics.\n\nFor me, Axon Med Academy is a very friendly and supportive academy. Whenever I approach them with any issue, I receive a quick response and the necessary support.",
    initials: "NK",
  },
  {
    name: "Kavitha.T",
    roll: "AXP26129",
    review: "My experience with Axon Med Academy has been truly wonderful and motivating. The uploaded video classes are very useful, well-organized, and easy to understand.\n\nAnother thing I really value is their friendly interaction with students. They take the time to understand our individual situations and difficulties rather than simply expecting results from us. This supportive approach makes students feel comfortable sharing their concerns and seeking guidance.",
    initials: "KT",
  },
  {
    name: "B. Hari Lakshmi",
    roll: "AXP26142",
    review: "The questions posted on telegram seems like a simple task daily.. But in future it helps a lot.. The portions for each test is not so much pressurizing on students and can be finished through consistent small efforts. The Academy is very friendly towards students and gives us space to discuss our problems.",
    initials: "BH",
  },
  {
    name: "Karthick T",
    roll: "AXP26152",
    review: "The axon academy provides a good learning experience. The faculty members explain concepts clearly and are supportive. The classes are well organized, and the study materials are useful for exam preparation. Overall, I am satisfied with the academy and appreciate the efforts of the faculty. With these improvements, the learning experience would become even better.\n\nThank you sir.",
    initials: "KT",
  },
  {
    name: "Axon Med Student",
    roll: "Axon Med Academy",
    review: "My experience with axon med academy has been good, i am able to contact manikandan sir for every minor doubts, this is more of a senior junior interaction which makes me feel free to ask even silly doubts...he has guided me in the correct way ..he understands every students situation and still manages to motivate us all to study no matter what, also the recorded classes are very much useful although the classes are of longer duration it covers half of the topics which makes us easy to study those topics again....the possibility to ask any doubts any time, the comfort manikandan sir has given so that we can be confident that sir will make us study, keeping us engaging by asking us to post questions in telegram group..discussion classes all these makes us easy…",
    initials: "AM",
  },
  {
    name: "Subathra T",
    roll: "AXP2686",
    review: "Good morning sir,\nFirst of all , I don't have any idea to get MD or MRB seat, after attending the orientation cls my thought was changed.After joining axon academy I did little task daily, I trust that like consistency help us a lot . Weekly once u give motivation that help us to be with tha plan. And the academy clears all the problem that we suggest.",
    initials: "ST",
  },
  {
    name: "Jeya A",
    roll: "AXP26121",
    review: "My experience with Axon med academy was good .The recorded videos are very useful for learning and revising the subjects.The explanations are clear and help us understand the concepts better.i would also like to appreciate the involvement of the staff.Their guidance and support are helpful whenever we have doubts or need clarification.Regular interaction with students.doubt clearing sessions and follow up from staff are useful.Overall ,I am happy with the learning support provided by Axon med academy and appreciate the effors of the teaching and supporting staff.\n\nThank you sir😇",
    initials: "JA",
  },
  {
    name: "S. K. Asmitha",
    roll: "AXP26179",
    review: "I'm thankful to axon for  guiding and motivating  us. The regular tests, telegram quiz, recorded videos helps us to learn easily. These make us to be consistent in studying .\nThank you sir",
    initials: "SA",
  },
  {
    name: "Priya Krishnan",
    roll: "Staff Nurse · Apollo Hospitals",
    review: "From classroom to a top hospital in 8 months. The proctored exams gave my employer real confidence.",
    initials: "PK",
    image: null,
  },
  {
    name: "Arjun Reddy",
    roll: "OT Technician · Manipal",
    review: "The hands-on OT simulation modules made my transition to the operating theatre seamless. Top-tier faculty.",
    initials: "AR",
    image: null,
  },
  {
    name: "Sneha Pillai",
    roll: "Lab Technician · Fortis",
    review: "I started with ₹999/month EMI and now earn 6× that monthly. The placement team was relentlessly supportive.",
    initials: "SP",
    image: null,
  },
];

function VideoThumbnail({ video, streamUrl, className }: { video: any; streamUrl: string; className?: string }) {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    const vid = document.createElement('video');
    vid.crossOrigin = 'anonymous';
    vid.muted = true;
    vid.preload = 'metadata';
    vid.src = streamUrl;
    vid.currentTime = 0.5; // seek to 0.5 sec

    vid.addEventListener('seeked', () => {
      const canvas = document.createElement('canvas');
      canvas.width = vid.videoWidth || 640;
      canvas.height = vid.videoHeight || 360;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        setThumb(canvas.toDataURL('image/jpeg', 0.6));
      }
      vid.remove();
    }, { once: true });

    vid.addEventListener('error', () => { vid.remove(); }, { once: true });

    return () => {
      vid.remove();
    };
  }, [streamUrl]);

  return (
    <div className={`absolute inset-0 ${className || ''}`}>
      {thumb ? (
        <img src={thumb} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-plum to-plum-dark" />
      )}
      <div className="absolute inset-0 bg-noise opacity-30" />
    </div>
  );
}

export function Testimonials() {
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [reviewVideos, setReviewVideos] = useState<any[]>([]);
  const [activeVideo, setActiveVideo] = useState<any | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<{ feedback: any; isNavy: boolean } | null>(null);

  // Home Page Add Feedback Modal Sheet state
  const [isAddFeedbackOpen, setIsAddFeedbackOpen] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ name: "", roll: "", review: "" });
  const [feedbackSubmittedSuccess, setFeedbackSubmittedSuccess] = useState(false);
  const [feedbackSubmitError, setFeedbackSubmitError] = useState<string | null>(null);

  // Photo upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [videoError, setVideoError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/public/testimonials")
      .then((res) => { if (res.success && res.testimonials?.length > 0) setTestimonials(res.testimonials); })
      .catch(() => {});

    api.get("/public/review-videos")
      .then((res) => { if (res.success) setReviewVideos(res.videos || []); })
      .catch(() => {});

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedFeedback(null);
        setActiveVideo(null);
        setIsAddFeedbackOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleSaveFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackForm.name.trim() || !feedbackForm.roll.trim() || !feedbackForm.review.trim()) {
      setFeedbackSubmitError("Please fill in Student Name, Reg No, and Feedback.");
      return;
    }

    setSubmittingFeedback(true);
    setFeedbackSubmitError(null);

    try {
      let res;
      if (selectedFile) {
        const formData = new FormData();
        formData.append("name", feedbackForm.name.trim());
        formData.append("roll", feedbackForm.roll.trim());
        formData.append("review", feedbackForm.review.trim());
        formData.append("image", selectedFile);
        res = await api.multipart("/public/testimonials", "POST", formData);
      } else {
        res = await api.post("/public/testimonials", {
          name: feedbackForm.name.trim(),
          roll: feedbackForm.roll.trim(),
          review: feedbackForm.review.trim(),
        });
      }

      if (res.success && res.testimonial) {
        setTestimonials((prev) => [res.testimonial, ...prev]);
        setFeedbackSubmittedSuccess(true);
        setTimeout(() => {
          setIsAddFeedbackOpen(false);
          setFeedbackSubmittedSuccess(false);
          setFeedbackForm({ name: "", roll: "", review: "" });
          setSelectedFile(null);
          setPreviewUrl(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }, 1800);
      } else {
        throw new Error(res.message || "Failed to save feedback");
      }
    } catch (err: any) {
      console.error("Feedback submit error:", err);
      setFeedbackSubmitError(err.message || "Failed to save feedback. Please try again.");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Build a streaming URL for the active video using the proxy endpoint
  const getStreamUrl = (video: any) => {
    if (!video) return '';
    // If video has an _id, use the presigned streaming endpoint
    if (video._id) {
      return `${API_BASE}/public/review-videos/${video._id}/stream`;
    }
    // Fallback to the stored videoUrl (legacy)
    return video.videoUrl || '';
  };

  const dynamicRow1 = testimonials.filter((t) => Number(t.row) === 1 || !t.row);
  const dynamicRow2 = testimonials.filter((t) => Number(t.row) === 2);

  const row1Feedbacks = [
    ...dynamicRow1,
    ...STUDENT_FEEDBACKS_ROW1,
  ];
  const marqueeItems1 = [...row1Feedbacks, ...row1Feedbacks];

  const row2Feedbacks = [
    ...dynamicRow2,
    ...STUDENT_FEEDBACKS_ROW2,
  ];
  const marqueeItems2 = [...row2Feedbacks, ...row2Feedbacks];

  const renderCard = (t: any, i: number, isNavy: boolean, rowId: string) => {
    const isLong = Boolean(t.review && (t.review.length > 170 || t.review.includes("\n")));
    return (
      <div
        key={`${rowId}-${t.roll || t.name}-${i}`}
        onClick={() => setSelectedFeedback({ feedback: t, isNavy })}
        className={`w-[340px] sm:w-[380px] lg:w-[400px] h-[280px] shrink-0 relative rounded-2xl p-6 border flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer select-none group ${
          isNavy ? "bg-navy text-white border-navy" : "bg-white text-navy border-gray-100 shadow-sm"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <Quote className={`h-7 w-7 ${isNavy ? "text-gold" : "text-navy/20"}`} />
          <div className="flex">
            {[...Array(5)].map((_, s) => (
              <Star key={s} className="h-3.5 w-3.5 fill-gold text-gold" />
            ))}
          </div>
        </div>

        {/* Review text with consistent clamp */}
        <div className="relative flex-1 overflow-hidden my-1 flex flex-col justify-start">
          <p className={`text-sm leading-relaxed line-clamp-4 ${isNavy ? "text-white/90" : "text-gray-700"}`}>
            "{t.review.replace(/\n+/g, " ")}"
          </p>
          {isLong && (
            <div className="mt-auto pt-1 flex items-center justify-between">
              <span className={`text-xs font-semibold flex items-center gap-1 transition-colors ${
                isNavy ? "text-gold group-hover:underline" : "text-navy group-hover:text-gold group-hover:underline"
              }`}>
                Read full feedback &rarr;
              </span>
              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                isNavy ? "bg-white/10 text-white/80" : "bg-gray-100 text-gray-600"
              }`}>
                Tap to view
              </span>
            </div>
          )}
        </div>

        {/* Footer with avatar & info */}
        <div className={`mt-3 flex items-center gap-3 pt-3 border-t shrink-0 ${isNavy ? "border-white/10" : "border-gray-100"}`}>
          <div
            className={`h-10 w-10 overflow-hidden rounded-full flex items-center justify-center font-display font-bold text-xs shrink-0 ${
              isNavy ? "bg-gold text-navy" : "bg-navy text-white"
            }`}
          >
            {t.image ? (
              <img src={getAssetUrl(t.image)} alt={t.name} className="h-full w-full object-cover rounded-full" />
            ) : (
              t.initials || t.name.charAt(0)
            )}
          </div>
          <div className="min-w-0">
            <div className={`font-semibold text-sm truncate ${isNavy ? "text-white" : "text-navy"}`}>{t.name}</div>
            <div className={`text-xs truncate ${isNavy ? "text-white/65" : "text-gray-500"}`}>{t.roll}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <section className="py-10 lg:py-16 bg-light-gray overflow-hidden">
        <div className="mx-auto w-full max-w-[1400px] px-5 lg:px-8">
          <div className="flex items-end justify-between flex-wrap gap-6 mb-12">
            <div className="max-w-xl">
              <div className="text-xs font-mono uppercase tracking-[0.2em] text-gold">— 05 / Voices</div>
              <h2 className="mt-3 font-display text-3xl lg:text-5xl font-extrabold text-navy tracking-tight">
                500 careers.<br />One academy.
              </h2>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-3 rounded-full bg-white border border-gray-200 px-4 py-2 shadow-sm">
                <div className="flex">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-gold text-gold" />)}
                </div>
                <span className="text-sm font-bold text-navy">4.9 / 5</span>
                <span className="text-xs text-gray-500">· 500+ reviews</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFeedbackSubmitError(null);
                  setFeedbackSubmittedSuccess(false);
                  setIsAddFeedbackOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-full bg-navy text-gold hover:bg-navy/90 border border-gold/40 px-5 py-2.5 text-sm font-bold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                <Plus className="h-4 w-4 text-gold" />
                <span>Add Feedback</span>
              </button>
            </div>
          </div>

          {/* Student Feedbacks Row 1: Right-to-Left Moving Marquee */}
          <div className="relative -mx-5 lg:-mx-8 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)] py-2">
            <div
              className="flex w-max marquee gap-6 hover:[animation-play-state:paused]"
              style={{
                animationDuration: "80s",
                animationPlayState: selectedFeedback ? "paused" : undefined,
              }}
            >
              {marqueeItems1.map((t: any, i: number) => renderCard(t, i, i % 2 === 1, "r1"))}
            </div>
          </div>

          {/* Student Feedbacks Row 2: Left-to-Right Moving Marquee */}
          <div className="relative -mx-5 lg:-mx-8 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)] py-2 mt-4">
            <div
              className="flex w-max marquee-reverse gap-6 hover:[animation-play-state:paused]"
              style={{
                animationDuration: "80s",
                animationPlayState: selectedFeedback ? "paused" : undefined,
              }}
            >
              {marqueeItems2.map((t: any, i: number) => renderCard(t, i, i % 2 === 0, "r2"))}
            </div>
          </div>

          {/* Video testimonial strip */}
          {reviewVideos.length > 0 && (
            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              {reviewVideos.slice(0, 3).map((v: any) => (
                <button
                  key={v._id || v.id}
                  onClick={() => { setActiveVideo(v); setVideoError(null); }}
                  className="group relative aspect-video overflow-hidden rounded-2xl"
                >
                  {/* Video thumbnail (captured first frame client-side) */}
                  <VideoThumbnail
                    video={v}
                    streamUrl={getStreamUrl(v)}
                    className="rounded-2xl"
                  />
                  {/* Play button overlay */}
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="grid h-14 w-14 place-items-center rounded-full bg-gold text-navy group-hover:scale-110 transition-transform">
                      <Play className="h-5 w-5 fill-current" />
                    </div>
                  </div>
                  {/* Title overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-left">
                    <div className="text-cream text-xs font-semibold truncate">{v.title}</div>
                    {v.studentName && (
                      <div className="text-cream/65 text-[10px] truncate">{v.studentName}{v.roll ? ` · ${v.roll}` : ""}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Fallback video strip if no videos uploaded yet */}
          {reviewVideos.length === 0 && (
            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <button key={i} className="group relative aspect-video overflow-hidden rounded-2xl bg-gradient-to-br from-navy to-navy">
                  <div className="absolute inset-0 bg-noise opacity-30" />
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="grid h-14 w-14 place-items-center rounded-full bg-gold text-navy group-hover:scale-110 transition-transform">
                      <Play className="h-5 w-5 fill-current" />
                    </div>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 text-white text-xs font-semibold">Watch student story #{i}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Video modal overlay */}
      {activeVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setActiveVideo(null)}
        >
          <div
            className="relative w-full max-w-3xl bg-navy rounded-3xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setActiveVideo(null)}
              className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Video player */}
            <div className="aspect-video bg-black">
              <video
                key={activeVideo._id || activeVideo.id}
                src={getStreamUrl(activeVideo)}
                controls
                autoPlay
                className="w-full h-full object-contain"
                onError={() => setVideoError("Failed to load video. The video may not be accessible.")}
              />
              {videoError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <p className="text-white text-sm px-4 text-center">{videoError}</p>
                </div>
              )}
            </div>

            {/* Video info */}
            <div className="px-6 py-4">
              <h3 className="font-display font-bold text-white text-base">{activeVideo.title}</h3>
              {activeVideo.studentName && (
                <p className="text-white/60 text-xs mt-1">
                  {activeVideo.studentName}{activeVideo.roll ? ` · ${activeVideo.roll}` : ""}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full feedback modal with matching card CSS and smooth normal animation */}
      {selectedFeedback && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedFeedback(null)}
        >
          <div
            className={`relative w-full max-w-lg rounded-2xl p-7 sm:p-8 border shadow-2xl animate-feedback-modal ${
              selectedFeedback.isNavy
                ? "bg-navy text-white border-navy"
                : "bg-white text-navy border-gray-200"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Quote + 5 Stars + Close Button */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Quote className={`h-8 w-8 ${selectedFeedback.isNavy ? "text-gold" : "text-navy/20"}`} />
                <div className="flex">
                  {[...Array(5)].map((_, s) => (
                    <Star key={s} className="h-4 w-4 fill-gold text-gold" />
                  ))}
                </div>
              </div>
              <button
                onClick={() => setSelectedFeedback(null)}
                className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors ${
                  selectedFeedback.isNavy
                    ? "bg-white/10 text-white hover:bg-white/20"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Review Text */}
            <div className="my-5 max-h-[55vh] overflow-y-auto pr-2">
              <p className={`text-base leading-relaxed whitespace-pre-line ${
                selectedFeedback.isNavy ? "text-white/95" : "text-gray-700"
              }`}>
                "{selectedFeedback.feedback.review}"
              </p>
            </div>

            {/* Footer: Avatar + Name + Roll */}
            <div className={`pt-5 border-t flex items-center gap-3.5 ${
              selectedFeedback.isNavy ? "border-white/10" : "border-gray-100"
            }`}>
              <div
                className={`h-11 w-11 overflow-hidden rounded-full flex items-center justify-center font-display font-bold text-sm shrink-0 ${
                  selectedFeedback.isNavy ? "bg-gold text-navy" : "bg-navy text-white"
                }`}
              >
                {selectedFeedback.feedback.image ? (
                  <img
                    src={getAssetUrl(selectedFeedback.feedback.image)}
                    alt={selectedFeedback.feedback.name}
                    className="h-full w-full object-cover rounded-full"
                  />
                ) : (
                  selectedFeedback.feedback.initials || selectedFeedback.feedback.name.charAt(0)
                )}
              </div>
              <div>
                <div className={`font-semibold text-base ${selectedFeedback.isNavy ? "text-white" : "text-navy"}`}>
                  {selectedFeedback.feedback.name}
                </div>
                <div className={`text-xs ${selectedFeedback.isNavy ? "text-white/65" : "text-gray-500"}`}>
                  {selectedFeedback.feedback.roll}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Feedback Popup Sheet */}
      {isAddFeedbackOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => {
            if (!submittingFeedback) setIsAddFeedbackOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg bg-[#0B1F3A] text-white rounded-3xl p-6 sm:p-8 border border-white/15 shadow-2xl relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-white/10">
              <div>
                <div className="text-xs font-mono uppercase tracking-widest text-gold flex items-center gap-1.5 font-semibold">
                  <span>Student Feedback Sheet</span>
                </div>
                <h3 className="text-2xl font-display font-bold text-white mt-1">Share Your Feedback</h3>
                <p className="text-xs text-white/60 mt-1">
                  Tell us about your experience with Axon Med Academy.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddFeedbackOpen(false)}
                className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {feedbackSubmittedSuccess ? (
              <div className="py-10 text-center space-y-3">
                <div className="h-14 w-14 rounded-full bg-gold/20 text-gold flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-gold" />
                </div>
                <h4 className="text-xl font-bold font-display text-white">Thank You!</h4>
                <p className="text-sm text-white/70 max-w-xs mx-auto">
                  Your feedback has been saved successfully and is now displayed in the academy testimonials.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSaveFeedback} className="mt-5 space-y-4">
                {feedbackSubmitError && (
                  <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{feedbackSubmitError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/80">
                    Student Name <span className="text-gold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={feedbackForm.name}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, name: e.target.value })}
                    placeholder="e.g. RANJITH KUMAR S"
                    className="w-full bg-white/5 border border-white/15 focus:border-gold rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/80">
                    Reg No <span className="text-gold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={feedbackForm.roll}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, roll: e.target.value })}
                    placeholder="e.g. AXP26164"
                    className="w-full bg-white/5 border border-white/15 focus:border-gold rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition-colors"
                  />
                </div>

                {/* Student Photo (Optional) */}
                <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/10">
                  <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-white/10 border border-white/15 grid place-items-center shrink-0">
                    {previewUrl ? (
                      <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                    ) : (
                      <Upload className="h-5 w-5 text-white/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white/90">Your Photo (Optional)</div>
                    <div className="text-[10px] text-white/50">Attach your photo or leave empty to use initials.</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                      >
                        {previewUrl ? "Change Photo" : "Upload Photo"}
                      </button>
                      {previewUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFile(null);
                            setPreviewUrl(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          className="text-[11px] text-red-300 hover:text-red-200 hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>

                {/* Feedback Review Text */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/80">
                    Feedback <span className="text-gold">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={feedbackForm.review}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, review: e.target.value })}
                    placeholder="Share your experience about recorded videos, mnemonics, Telegram questions, weekend discussion classes, and test series..."
                    className="w-full bg-white/5 border border-white/15 focus:border-gold rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition-colors leading-relaxed resize-y"
                  />
                </div>



                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddFeedbackOpen(false)}
                    className="px-5 py-2.5 rounded-full text-sm font-semibold text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingFeedback}
                    className="inline-flex items-center gap-2 rounded-full bg-gold text-navy hover:bg-gold/90 font-bold px-6 py-2.5 text-sm shadow-lg shadow-gold/20 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {submittingFeedback ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Feedback</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
