import { GoogleGenAI } from "@google/genai";
import { AIResource } from "../types";

export const generateLessonPlan = async (
  topic: string, 
  classType: string, 
  bookName: string,
  resource?: AIResource
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const parts: any[] = [];
    
    // Add resource if available
    if (resource) {
      // Check for extremely large files that will definitely fail XHR
      // Base64 is ~1.33x original size. Limit to approx 10MB raw data to be safe
      if (resource.data.length > 14 * 1024 * 1024) { 
         throw new Error("FILE_TOO_LARGE");
      }

      parts.push({
        inlineData: {
          mimeType: resource.mimeType,
          data: resource.data
        }
      });
    }

    const promptText = `
      نقش تو یک دستیار آموزشی حرفه‌ای است.
      موضوع درس: "${topic}"
      نام کتاب درسی: "${bookName}"
      نوع کلاس: "${classType}"
      
      ${resource ? 'لطفاً با توجه به فایل پیوست شده (که بخشی از کتاب یا منبع آموزشی است) و موضوع داده شده،' : 'لطفاً'} 
      یک طرح درس روزانه خلاصه و کاربردی بنویس.
      
      ساختار خروجی باید مارک‌داون (Markdown) باشد و شامل موارد زیر:
      1. اهداف رفتاری
      2. رئوس مطالب
      3. فعالیت‌های یادگیری
      4. روش تدریس پیشنهادی
      5. ارزشیابی

      زبان: فارسی
    `;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
    });

    return response.text || "خطا در تولید طرح درس";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    const msg = error.toString();
    
    if (msg.includes("FILE_TOO_LARGE") || msg.includes("xhr error") || msg.includes("Rpc failed") || msg.includes("413")) {
      return "⚠️ خطا: حجم فایل پیوست شده برای پردازش توسط هوش مصنوعی بسیار زیاد است.\n\nلطفاً برای دریافت نتیجه بهتر:\n1. از تصاویر با حجم کمتر استفاده کنید (برنامه تصاویر را خودکار فشرده می‌کند).\n2. اگر فایل PDF است، از صفحات کمتری استفاده کنید.\n3. یا بدون فایل پیوست و فقط با موضوع متنی تلاش کنید.";
    }
    
    return "خطا در برقراری ارتباط با سرویس هوش مصنوعی. لطفاً اتصال اینترنت خود را بررسی کنید.";
  }
};