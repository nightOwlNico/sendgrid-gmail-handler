require('dotenv').config();
const express = require('express');
const multer = require('multer');
const sgMail = require('@sendgrid/mail');
const { Mail } = require('@sendgrid/helpers/classes');
const cheerio = require('cheerio');
const path = require('path');

function checkRequiredEnvironmentVariables() {
  const requiredVars = ['SENDGRID_API_KEY', 'FROM_EMAIL', 'TO_EMAIL'];

  for (const variable of requiredVars) {
    if (!process.env[variable]) {
      throw new Error(
        `Missing required environment variable: ${variable}. Please set it in your .env file or environment.`
      );
    }
  }
}

checkRequiredEnvironmentVariables();

const app = express();
const port = process.env.PORT || 3000;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

function isHtmlContentEmpty(html) {
  const $ = cheerio.load(html);

  const textContent = $.text().trim();
  const elementsToCheck = [
    'img',
    'a',
    'ul',
    'ol',
    'table',
    'form',
    'video',
    'audio',
    'iframe',
    'style',
    'script',
    'pre',
    'blockquote',
    'canvas',
    'svg',
    'object',
  ];

  let hasElements = false;

  for (const tagName of elementsToCheck) {
    if ($(tagName).length > 0) {
      hasElements = true;
      break;
    }
  }

  return !hasElements && textContent === '';
}

function hasUnsafeFileTypes(files) {
  const unsafeExtensions = ['.exe', '.bat', '.js', '.sh', '.dll', '.jar'];
  return files.some((file) => {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    return unsafeExtensions.includes(fileExtension);
  });
}

function isEmailEncrypted(text, html) {
  const encryptedKeywords = [
    // PGP related keywords
    '-----BEGIN PGP MESSAGE-----',
    '-----BEGIN PGP SIGNED MESSAGE-----',
    '-----BEGIN PGP SIGNATURE-----',
    'application/pgp-encrypted',

    // S/MIME related keywords
    '-----BEGIN PKCS7-----',
    '-----END PKCS7-----',
    'application/pkcs7-mime',
    'application/x-pkcs7-mime',
    'smime.p7m',
    'smime.p7s',
  ];

  const contentToCheck = text + html;

  return encryptedKeywords.some((keyword) => contentToCheck.includes(keyword));
}

function calculateEmailMessageSize(msg) {
  const jsonMsg = msg.toJSON();
  let size = 0;

  // Calculate the size of text and html content
  if (jsonMsg.content) {
    jsonMsg.content.forEach((content) => {
      const contentBuffer = Buffer.from(content.value, 'utf-8');
      size += contentBuffer.length;
    });
  }

  // Calculate the size of attachments
  if (jsonMsg.attachments) {
    jsonMsg.attachments.forEach((attachment) => {
      const attachmentBuffer = Buffer.from(attachment.content, 'base64');
      size += attachmentBuffer.length;
    });
  }

  return size;
}

app.post('/sendgrid-webhook', upload.any(), async (req, res) => {
  // console.log('req.body', req.body);

  try {
    const {
      from,
      subject,
      text,
      html,
      'attachment-info': attachmentInfo,
    } = req.body;

    if (!from) {
      return res.status(400).send('Missing required field: from');
    }

    const msg = new Mail();
    msg.setFrom(process.env.FROM_EMAIL);
    msg.setReplyTo(from);
    msg.addTo(process.env.TO_EMAIL);
    msg.setSubject(subject ? `${from}: ${subject}` : `${from}: (No Subject)`);

    if ((!text || text.trim() === '') && isHtmlContentEmpty(html)) {
      msg.addTextContent(`Original message from ${from} had no content.`);
      msg.addHtmlContent(
        `<p>Original message from ${from} had no content.</p>`
      );
    } else {
      if (text && text.trim() !== '') {
        msg.addTextContent(`Original message from ${from}:\n\n${text}`);
      }

      if (html && !isHtmlContentEmpty(html)) {
        msg.addHtmlContent(`Original message from ${from}:<br/><br/>${html}`);
      }
    }

    if (isEmailEncrypted(text, html)) {
      const errorMsg = new Mail();
      errorMsg.setFrom(process.env.FROM_EMAIL);
      errorMsg.addTo(process.env.TO_EMAIL);
      errorMsg.setSubject(
        `[ENCRYPTED EMAIL] Email from ${from} could not be forwarded`
      );
      errorMsg.addTextContent(
        `WARNING: The email from ${from} is encrypted and could not be forwarded.`
      );
      errorMsg.addHtmlContent(
        `<p style="font-size: 24px; font-weight: bold; color: red;">WARNING: Encrypted Email</p><p>The email from ${from} is encrypted and could not be forwarded.</p>`
      );

      await sgMail.send(errorMsg);
      res.status(200).send('Failure notice sent');
      return;
    }

    if (req.files && req.files.length > 0) {
      let parsedAttachmentInfo;

      try {
        parsedAttachmentInfo = JSON.parse(attachmentInfo);
      } catch (error) {
        console.warn(
          'Malformed attachment-info encountered, continuing without attachments.'
        );
        parsedAttachmentInfo = {};

        const warningText =
          'WARNING: The attachment data was malformed, and none of the sent attachments could be included.';
        const warningHtml = `<p style="font-size: 18px; font-weight: bold; color: red;">${warningText}</p>`;

        if (msg.text) {
          msg.text += `\n\n${warningText}`;
        } else {
          msg.addTextContent(warningText);
        }

        if (msg.html) {
          msg.html += `<br/><br/>${warningHtml}`;
        } else {
          msg.addHtmlContent(warningHtml);
        }
      }

      req.files.forEach((file) => {
        const contentId = parsedAttachmentInfo[file.fieldname]['content-id'];
        const attachment = {
          content: file.buffer.toString('base64'),
          filename: file.originalname,
          type: file.mimetype,
          content_id: contentId,
        };

        // Set the disposition to inline if the contentId is used in the HTML content
        if (html && html.includes(`cid:${contentId}`)) {
          attachment.disposition = 'inline';
        } else {
          attachment.disposition = 'attachment';
        }

        msg.addAttachment(attachment);
      });
    }

    if (hasUnsafeFileTypes(req.files)) {
      const warningText =
        'WARNING: This email contains potentially unsafe file types.';
      const warningHtml = `<p style="font-size: 18px; font-weight: bold; color: red;">${warningText}</p>`;

      if (msg.text) {
        msg.text += `\n\n${warningText}`;
      } else {
        msg.addTextContent(warningText);
      }

      if (msg.html) {
        msg.html += `<br/><br/>${warningHtml}`;
      } else {
        msg.addHtmlContent(warningHtml);
      }
    }

    // Check if the total email size exceeds SendGrid's 30 MB size limit for the v3 API
    const totalEmailSize = calculateEmailMessageSize(msg);

    if (totalEmailSize > 30 * 1024 * 1024) {
      const errorMsg = new Mail();
      errorMsg.setFrom(process.env.FROM_EMAIL);
      errorMsg.addTo(process.env.TO_EMAIL);
      errorMsg.setSubject(
        `[EMAIL TOO LARGE] Email from ${from} could not be forwarded`
      );
      errorMsg.addTextContent(
        `WARNING: The email from ${from} exceeded the 30 MB size limit and could not be forwarded.`
      );
      errorMsg.addHtmlContent(
        `<p style="font-size: 24px; font-weight: bold; color: red;">WARNING: Email too large</p><p>The email from ${from} exceeded the 30 MB size limit and could not be forwarded.</p>`
      );

      await sgMail.send(errorMsg);
      res.status(200).send('Failure notice sent');
      return;
    }

    // console.log('Sending message:', msg.toJSON());

    await sgMail.send(msg);
    res.status(200).send('Email forwarded successfully');
  } catch (error) {
    console.error('Error:', error);
    let errorMessage = 'Error forwarding email';
    let statusCode = 500;

    if (error.response) {
      console.error('Error response body:', error.response.body);
      statusCode = error.response.status;

      if (
        error.response.body &&
        error.response.body.errors &&
        error.response.body.errors.length > 0
      ) {
        errorMessage = error.response.body.errors
          .map((err) => err.message)
          .join('; ');
      }
    }

    res.status(statusCode).send(errorMessage);
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
