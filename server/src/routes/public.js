const express = require('express');
const router = express.Router();
const FacultyMember = require('../models/FacultyMember');
const AboutDetail = require('../models/AboutDetail');
const Milestone = require('../models/Milestone');
const HospitalPartner = require('../models/HospitalPartner');
const PlacementStory = require('../models/PlacementStory');
const BlogPost = require('../models/BlogPost');
const ContactDetail = require('../models/ContactDetail');
const Inquiry = require('../models/Inquiry');
const Testimonial = require('../models/Testimonial');
const ReviewVideo = require('../models/ReviewVideo');
const https = require('https');
const http = require('http');
const { generatePresignedGetUrl } = require('../config/cloudflare');

// GET /programs → Published programs list
router.get('/programs', (req, res) => {
  res.json({ success: true, programs: [] });
});

// GET /programs/:slug → Program detail
router.get('/programs/:slug', (req, res) => {
  res.json({ success: true, program: { slug: req.params.slug } });
});

// GET /faculty → Faculty directory
router.get('/faculty', async (req, res, next) => {
  try {
    const facultyList = await FacultyMember.find().sort({ createdAt: 1 });
    res.json({ success: true, facultyList });
  } catch (error) {
    next(error);
  }
});

// GET /testimonials → Student testimonials
router.get('/testimonials', async (req, res, next) => {
  try {
    const testimonials = await Testimonial.find().sort({ createdAt: -1 });
    res.json({ success: true, testimonials });
  } catch (error) {
    next(error);
  }
});

// GET /review-videos → Student video reviews
router.get('/review-videos', async (req, res, next) => {
  try {
    const videos = await ReviewVideo.find().sort({ createdAt: -1 });
    res.json({ success: true, videos });
  } catch (error) {
    next(error);
  }
});

/**
 * Proxy function: fetch a remote URL and pipe its response to the client.
 * This avoids CORS / cross-origin redirect blocks that browsers enforce.
 */
function pipeRemoteUrl(remoteUrl, req, res, next) {
  const urlObj = new URL(remoteUrl);
  const transport = urlObj.protocol === 'https:' ? https : http;

  // Forward Range header from the client (required for video seeking)
  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port,
    path: urlObj.pathname + urlObj.search,
    method: 'GET',
    headers: {
      'User-Agent': 'OC-Pro-Stream/1.0',
    },
  };

  // Copy the Range header if the client sent one (for seeking / scrubbing)
  if (req.headers.range) {
    options.headers['Range'] = req.headers.range;
  }

  const clientReq = transport
    .get(options, (remoteRes) => {
      // Forward the status code (206 Partial Content for range requests)
      res.status(remoteRes.statusCode);

      // Forward relevant response headers
      const forwardHeaders = [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'cache-control',
        'etag',
        'last-modified',
      ];
      forwardHeaders.forEach((header) => {
        const value = remoteRes.headers[header];
        if (value) {
          res.setHeader(header, value);
        }
      });

      // Strip any restrictive cross-origin headers that R2 might send
      res.removeHeader('cross-origin-resource-policy');

      // Allow embedding from any origin (video is proxied through our server)
      res.setHeader('cross-origin-resource-policy', 'cross-origin');

      // Pipe the remote data to the client
      remoteRes.pipe(res);

      // Destroy the remote response stream if the client closes the connection
      req.on('close', () => {
        remoteRes.destroy();
      });
    })
    .on('error', (err) => {
      next(err);
    });

  // Destroy the remote request if the client closes the connection before response is received
  req.on('close', () => {
    clientReq.destroy();
  });
}

// GET /review-videos/:id/stream → Proxy stream a review video via presigned GET URL
router.get('/review-videos/:id/stream', async (req, res, next) => {
  try {
    const video = await ReviewVideo.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, message: 'Review video not found' });
    }

    if (!video.cloudflareKey) {
      // Fallback: if no cloudflareKey, proxy the stored videoUrl directly
      return pipeRemoteUrl(video.videoUrl, req, res, next);
    }

    // Generate a presigned GET URL (valid for 1 hour)
    const presignedUrl = await generatePresignedGetUrl(video.cloudflareKey, 3600);
    // Proxy through our server instead of redirecting (avoids cross-origin block)
    pipeRemoteUrl(presignedUrl, req, res, next);
  } catch (error) {
    next(error);
  }
});

// GET /stats → Platform stats (students, partners, etc.)
router.get('/stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      studentsCertified: 12000,
      partnerHospitals: 450,
      globalAlumni: 85000,
      excellenceAwards: 12
    }
  });
});

// GET /certificate/verify/:no → Verify certificate
router.get('/certificate/verify/:no', (req, res) => {
  res.json({ success: true, valid: true, certificateNumber: req.params.no });
});

// --- NEW PUBLIC GET ENDPOINTS ---

// GET /about → Get about details & milestones
router.get('/about', async (req, res, next) => {
  try {
    const about = await AboutDetail.findOne() || { mission: '', vision: '', values: '' };
    const milestones = await Milestone.find().sort({ year: 1 });
    res.json({ success: true, about, milestones });
  } catch (error) {
    next(error);
  }
});

// GET /placements → Get placements (partners & stories)
router.get('/placements', async (req, res, next) => {
  try {
    const partners = await HospitalPartner.find().sort({ name: 1 });
    const stories = await PlacementStory.find().sort({ createdAt: -1 });
    res.json({ success: true, partners, stories });
  } catch (error) {
    next(error);
  }
});

// GET /blogs → Get all blog posts
router.get('/blogs', async (req, res, next) => {
  try {
    const blogs = await BlogPost.find().sort({ createdAt: -1 });
    res.json({ success: true, blogs });
  } catch (error) {
    next(error);
  }
});

// GET /contact-details → Get public contact details
const defaultContactDetails = {
  name: "Axon Med Academy",
  url: "axonmedacademy",
  address: "Plot 21, Medical Campus, Hosur Road, Bengaluru - 560001",
  phone: "+91 98765 43210",
  email: "hello@axon.academy",
  hours: "Monday - Saturday, 9 AM to 8 PM",
  gst: "29AABCM1234C1ZK",
  timezone: "Asia/Kolkata",
  about: "India's most trusted paramedical training academy."
};

router.get('/contact-details', async (req, res, next) => {
  try {
    let contactDetails = await ContactDetail.findOne();
    if (!contactDetails) {
      contactDetails = {
        address: "Plot 21, Medical Campus, Hosur Road, Bengaluru — 560001",
        phone: "+91 98765 43210",
        email: "hello@axon.academy",
        hours: "Monday – Saturday, 9 AM to 8 PM"
      };
    }
    res.json({ success: true, contactDetails });
  } catch (error) {
    next(error);
  }
});

// POST /contact → Submit a counselling inquiry / lead
router.post('/contact', async (req, res, next) => {
  try {
    const { name, email, phone, interest, message } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }
    const inquiry = await Inquiry.create({ name, email, phone, interest, message });
    res.status(201).json({ success: true, message: 'Counselling inquiry submitted successfully', inquiry });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
