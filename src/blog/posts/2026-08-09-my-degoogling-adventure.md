---
title: My Degoogling Adventure
date: 2026-08-09
description: Google shouldn't have such a stranglehold on everything I want to do online.
---

# Google shouldn't have such a stranglehold on everything I want to do online.

I remember the days in middle school where I couldn't wait to start my online presence, like many of us, my first step was to set up an email account.

Yahoo was still.. relevant? at the time, but I decided to go with Google, and up until this month, that very email stuck with me, one way or another. Over the years I had strayed away from using that email, primarily because of just how much crap it was tied to. Facebook, Wattpad, and the fact it contained the name I no longer go by. Since then, I had  made a "professional" email, i.e, first+last and a few numbers @gmail.com. In addition, I had made a new email, using my new name, it felt nice. Moving everything that mattered to me to the new email was a bit of a pain, and it wasn't the first I had to do so.

At the end of the day though, that email was still... a Google email. I never really stopped to think just how much of my online presence or activity was powered by Google. Google Photos, Google Drive, Google Maps, Goog- the list is absurdly long. And while yes it is certainly convenient, it makes you wonder how they are making their money. Like just about every free service, ***you*** are the product. Google knows just about everything there is to know about you, more than you might even know about yourself.

The very thought of that is just dreadful to think about. Obviously one cannot feasibly be "invisible" without  vasts amount of effort or delusion, but at the very least, you can gain control of who you want to have your data. Maybe Big Zuckerberg, Apple, or Microsoft? Pick your poison. But, in my opinion, if you *can*, you should. Obviously this blog is about Degoogling, but the bigger picture is to De-Big Tech, but, thats out of the scope here.

## So, where did I start?

For my journey, I started with the right hardware.

Like many of my decisions, it was made on impulse on a  random weekday  evening. I had just graduated from college, and had a lot more free time on my hands, aside from work. One thing I love to do on my devices is cut down on as many apps as possible. Consolidate everything, and cut out the "bloat" - When you look at a normal Android phone, it comes pre-installed with dozens of junk apps. My Motorola Edge 2024 was *riddled* with generative AI crap, apps I would never use, and a god awful AI-powered lock screen application that would insist upon itself every single time I restarted my phone.

And then of course, you have the dozens of Google apps. Gmail, Youtube, Google Calendar, etc. Many of which I never really used. Even with ADB, I couldn't remove everything. Many of the apps were forced onto the device by the vendor. And so then, the thought of using an alternative OS on my phone came up, [LineageOS](https://lineageos.org/) appears to have support for my phone, but if I was going to jump ship, I wanted to do it "right" - this is very subjective. I *could* have gone with Lineage, but I am a very impressionable person, and the name "GrapheneOS" just sounded cooler! It also is just outright superior in my opinion, as long as one has the means to obtain a Google Pixel, which, I still think is absolutely hilarious and ironic  to be the sole vendor Graphene supports.

And so, the thoughts of handing my current phone down to my wife(she definitely needs an upgrade/replacement) and buying a Pixel loomed over my head for a few days. Eventually, I said fuck it. I'll just buy one. So I went with the Pixel 10a, which has furthest support window, up until 2033. Let's just say that Pixel had stock Android installed for no more than 5 minutes. Just had to connect it to the internet so it could verify OEM unlock settings.

## But what about the actual software?

Having already spun up Immich to replace Google Photos, the process had already been started, but was merely the beginning. I had at least 4 Google emails, with varying levels of actual use/importance. Don't ask why, I don't know myself.

The very first step was to migrate my email. The first idea that came to mind was Proton Mail, which, worked for a little while, more on that later.

Moving everything was slightly painful, but along the way, I made sure my password manager actually had everything, so two birds with one stone. After that, I wanted to get rid of what Google accounts I could. I was fairly aggressive and nuclear with this process, but I wanted to rip the bandaid off. All of the Google accounts I could get access to were deleted over the span of 3 days. Some took some time as my dumbass got locked out and had to wait 24-48 hours for Google to graciously grant me access.

But now for the actual software. Using [PrivacyPack](https://privacypack.org/), one can fairly easily see alternative at a glance, it offers a nice way to see everything at once, and share it.

To spare the endless spew of details, I will just share mine:

![My PrivacyPack](https://images.spellbound.sh/privacypack.png "My PrivacyPack")

Many of which I had already made the switch to. Immich, DuckDuckGo, FireFox, BitWarden, etc.

I realized I didn't really care for what Proton had to offer beyond their free email service. What I didn't  like however, was the constant shoving of advertisements in my face to "upgrade now for just $1" or "special discount!" - Just shut up. 

I kept hearing about how much people despise Proton nowadays, and so I... De-Proton'd? Pretty straightforward. I opted for [Mailbox.org](mailbox.org). Something a little more quiet, plenty of fun emails to pick, such as.. ``boobies@mailbox.org`` tehe. Didn't actually claim it, probably won't let you but who knows.  Only caveat was that it costs money. Not that much though, just 12 pounds/year for their basic plan, more than enough for me. On my phone, I use Mozilla Thunderbird as my email app, but on my desktop/laptop, I just use their website, works just fine.

## The Big One: Sourcing the applications

I am by no means educated in this, but the following stack works well for me:

If the application is source available, use [Obtainium](https://github.com/ImranR98/Obtainium) to pull it directly from the source. No need to deal with an app store, works great. Plenty of documentation and crowdsourced configurations to get everything set up with ease.

If I am ever having issues with Obtainium, [F-Droid](https://f-droid.org/) is my next place to source it. I am still a chud and still use a few apps I honestly shouldn't be, but many of my friends use Discord, Instagram, and Twitter, so, I source them from [Aurora Store](https://store.auroraoss.com/). This app is wonderful, you don't even need to log in, you just open it up and skip the login. I treat it as my last resort though.

I indulge in many of the [Fossify](https://www.fossify.org/apps/) suite, such as Calculator, Calendar(synced to mailbox.org via [DAVx⁵](https://www.davx5.com/)), Clock, and Paint. Graphene comes with many of these, but the only Graphene apps I stuck to were the Camera, Files, Messaging, and Phone app. Not sure how to disable them, but when I do, I will likely use their Fossify alternatives.

One that I am not fully settled on is my replacement for Youtube. Currently, i self host an [Invidious](https://invidious.io/) instance, that is automatically redirected to via [LibRedirect](https://libredirect.manerakai.com/). It Just Works. The only pain point is the UI is purely utilitarian, I need at least a little bit of swag, right?

## So what now?

I would definitely consider my quest of de-googling complete. The only hint of Google is the sandboxed Google Play services that many apps require. Graphene does a great job of neutering it though, so its a non-issue to me at this time.

In the future, I would love to get rid of Instagram, Twitter, and Discord. But those will have to wait for another impulsive decision to happen on a random weekday evening.
