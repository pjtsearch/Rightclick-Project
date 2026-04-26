# Field Estimate Tool

## The Problem

Our HVAC technicians are losing time on every service call.

Right now, when a tech gets to a job site and needs to give the customer an estimate, here's what happens: they flip through a product binder or scroll through a spreadsheet on their phone, look up equipment costs, try to remember the labor rates for different job types, factor in the specifics of the property, and then scribble numbers on a notepad or punch them into a calculator. Sometimes they call the office to double-check pricing. Sometimes they guess and adjust later.

The customer is standing there the whole time.

A simple repair estimate might take 10-15 minutes. A full system replacement quote can take 30-45 minutes on-site, and that's before the tech has to go back to their truck to write it up in a way the customer can actually read. Some techs text a photo of their handwritten notes to the office and have someone there type it up. Others just wing it and send a "real" estimate later that evening.

We've got about 40 technicians in the field. If each one does 4-6 estimates a day, that's a lot of wasted time — and a lot of customers standing around waiting. We've heard from customers that the wait makes the whole experience feel less professional, and we've definitely lost jobs because a competitor got a clean estimate out faster.

## What We Have

In the `data/` folder, you'll find some of the information our techs work with:

- **equipment.json** — Our catalog of HVAC equipment and parts with pricing
- **labor_rates.json** — What we charge for different types of work
- **customers.json** — A sample of customer and property records

This is real-ish data pulled from our systems. It's not perfect — some of it was exported from different tools at different times, so it might not all look the same.

## What We're Asking

Build something that helps.

Fork this repo, build your solution, and include a short write-up explaining your approach — what you built, why you made the choices you did, and what you'd do differently with more time.

## Demo

## Writeup

### What I built

I built a full stack web-app for quickly creating and managing HVAC quotes. It is a PWA that works fully offline. It also includes a voice assistant which can edit the fields in the draft quote. In addition, it includes functionality for marking quotes as accomplished when the work described in them has been done and then updating the last serviced date of the customer.

### Why I made the choices I did

#### Having back end

Probably the most significant design decision that I made was to have the app have a backend server rather than having it be all client side. I made this decision since the web-app is supposed to be able to be used by multiple technicians and in the field, so it would probably be necessary for the labor rates, inventory, customers, quotes etc. to be synced between them for the app to be useful. Additionally, I wanted to demonstrate my full-stack capabilities.

#### Offline

Another major design decision was to make the app work offline as well. I thought that this would be important since HVAC technicians go all over the place and some places where they go may not have good cell reception.

#### Replacing customer ids

A decision related to this was to replace the sequential customer ids with UUIDs. This allowed customers to be created when the device is offline without the risk of there being a conflict when the device comes back online and tries to sync.

#### Add quote interface

Another significant decision was to have the equipment and the labor be in two separate stages of the add quote form, rather than having just one stage for adding line items. I had originally chosen the latter approach, but after looking at the submissions of the other applicants, I became convinced that the former approach would be easier and quicker to use for the technicians.

#### Voice assistant

The inclusion of the voice assistant was another significant decision. I thought that it would be helpful to speed up the technician. I thought it would be particularly important for the agent to keep the conversation context so that it would be possible for it to ask follow up questions in case what the technician said was too vague. I chose to use the OpenAI Realtime API (which is speech-to-speech) since I thought it would give the quickest and most seamless experience, and it would not require a separate TTS.

I also chose to make the web-app fully functional without the voice assistant as well since I wanted it to work offline and so that technicians could interact with the app in the way they preferred.

### Front-end tech stack

I haven't used web components for a few years, but I was inspired to try them again after reading [this article](https://developer.mozilla.org/en-US/blog/mdn-front-end-deep-dive/) about how MDN switched to using them. I decided to use LitElement to simplify the components, and I decided to use the MDUI component library so that I didn't have to make those basic components myself.

### Back-end tech stack

I wanted the server to be as simple and straightforward as possible, so I started out with Express and doing plain SQL queries with the builtin `node:sqlite`. However, I wanted the quote objects sent and received by the server to be able to include the customer and the quote's equipment and labor with it, and this created some significant complication. So, I decided to use an ORM to abstract some of that away. I specifically chose Drizzle since it's pretty new and I hadn't tried it out before.

### What I'd do differently with more time

1. I would add some form of authentication to the web-app
2. I would add functionality for editing customers and updating the labor rates and equipment
3. I would spend more time refactoring the code to make it cleaner. I have a high standard for code cleanliness, and I wasn't able to reach it given the time constraint
4. I would improve the customer stage of the add quote page; specifically, I would make it so that you could edit the details of the customer you have selected after you clicked on them
5. I would switch the voice assistant to use a cheaper speech-to-speech service like Nova 2 Sonic or using a regular multimodal model combined with a TTS in order to decrease costs, since OpenAI Realtime API is quite expensive for this use case

## Usage

1. Install dependencies for server

   ```bash
   npm install
   ```

2. Initialize database and import the data from the JSONs

   ```bash
   npm run initDatabase db.sql
   npm run importJsons db.sql
   ```

3. Start server

   ```bash
   npm run server db.sql
   ```

4. Install dependencies for client

   ```bash
   cd client
   npm install
   ```

5. Build client

   ```bash
   npm run client:build
   ```

6. View webapp at http://localhost:3000
