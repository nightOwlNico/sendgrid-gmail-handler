require('dotenv').config();
const express = require('express');
const multer = require('multer');
const sgMail = require('@sendgrid/mail');

const app = express();
const port = process.env.PORT || 3000;
const upload = multer();
app.use(upload.any());

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

app.post('/sendgrid-webhook', async (req, res) => {
  console.log(req.body);

  try {
    // ==========
    const {
      headers,
      dkim,
      contentIds,
      to,
      text,
      html,
      from,
      senderIp,
      spamReport,
      envelope,
      attachments,
      subject,
      spamScore,
      attachmentInfo,
      charsets,
      SPF,
    } = req.body;

    const msg = {
      to: 'nightOwlNico@gmail.com',
      from: 'Nico@NightOwlNico.com', // Use the verified 'from' address
      REALtoFIELD: '',
      REALfromFIELD: '',
    };

    if (headers) {
      msg.headers = headers;
    }

    if (dkim) {
      msg.dkim = dkim;
    }

    if (contentIds) {
      msg.contentIds = contentIds;
    }

    if (to) {
      msg.REALtoFIELD = to;
    }

    if (text) {
      msg.text = text;
    }

    if (html) {
      msg.html = html;
    }

    if (from) {
      msg.REALfromFIELD = from;
    }

    if (senderIp) {
      msg.senderIp = senderIp;
    }

    if (spamReport) {
      msg.spamReport = spamReport;
    }

    if (envelope) {
      msg.envelope = envelope;
    }

    if (attachments) {
      msg.attachments = attachments;
    }

    if (subject) {
      msg.subject = subject;
    }

    if (spamScore) {
      msg.spamScore = spamScore;
    }

    if (attachmentInfo) {
      msg.attachmentInfo = attachmentInfo;
    }

    if (charsets) {
      msg.charsets = charsets;
    }

    if (SPF) {
      msg.SPF = SPF;
    }
    // ==========
    // const { from, subject, text, html, attachments } = req.body;

    // Convert attachments if they exist and are an array
    // const convertedAttachments =
    //   attachments && Array.isArray(attachments)
    //     ? attachments.map((attachment) => {
    //         const { originalname, buffer, mimetype } = attachment;
    //         return {
    //           filename: originalname,
    //           content: buffer.toString('base64'),
    //           contentType: mimetype,
    //         };
    //       })
    //     : [];

    // const msg = {
    //   to: 'nightOwlNico@gmail.com',
    //   from: 'Nico@NightOwlNico.com', // Use the verified 'from' address
    // };

    // if (from && from.address) {
    //   msg.replyTo = from.address; // Set the 'reply-to' field to the original sender's email address
    // }

    // msg.subject = subject ? `Forwarded: ${subject}` : 'Forwarded email';

    // if (!text) {
    //   msg.text = `Original sender: ${from.address}\n\nNo text content provided.`;
    // } else {
    //   msg.text = `Original sender: ${from.address}\n\n${text}`;
    // }

    // if (!html) {
    //   msg.html = `Original sender: ${from.address}<br/><br/>No HTML content provided.`;
    // } else {
    //   msg.html = `Original sender: ${from.address}<br/><br/>${html}`;
    // }

    // if (convertedAttachments.length > 0) {
    //   msg.attachments = convertedAttachments;
    // }

    //console.log('Sending message:', msg);

    await sgMail.send(msg);
    res.status(200).send('Email forwarded successfully');
  } catch (error) {
    console.error('Error:', error);
    if (error.response) {
      console.error('Error response body:', error.response.body);
    }
    res.status(500).send('Error forwarding email');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
