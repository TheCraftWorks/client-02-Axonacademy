require('dotenv').config();

async function listModels() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("No GEMINI_API_KEY found in .env");
    return;
  }
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    console.log("Available models:");
    if (data.models) {
      data.models.forEach(model => {
        console.log(`- ${model.name}`);
      });
    } else {
      console.log(data);
    }
  } catch (error) {
    console.error("Error fetching models:", error);
  }
}

listModels();
