---
title: The NixOS Disease
date: 2026-08-09
description: A look into my Linux journey
---

# All roads lead to Nix. It's true.

I have only been using Linux for two and a half years now. I briefly used it during the Filthy Frank era via an Ubuntu VM just so I could use LMAOBOX on casual 2fort, but beyond that, not really.

Since then, I did have to temporarily use Windows, for my sanity. Trying to get Debian to work on the Lenovo Legion 7 I had was always a disaster. The closest I got to "stability" was with CachyOS. Didn't quite like the vibes. I was still in college at the time, and many of my classes insisted on proprietary slop anyways, many of which did not have easy Linux support. A Windows VM or something like Winboat *could* have worked, but I didn't want to spend much of my free time just to do my homework.

My first real experience with Linux was with Linux Mint. It was just.. nice. I didn't last long though, as it felt quite dry and a bit boring. I wanted a challenge! Straight to the beloved Arch Linux, manually installing like a 1337 hax0r (I typed word for word what Mutahar wrote). Arch Linux was quite nice, it felt much more customizable and open, even though I had no idea what I was doing, and preferred GNOME of all things over KDE, Cinnamon, etc.

For a while I had no issues with Arch. I even tried to run a few servers with it, before I even knew what the hell a Docker was. It was rancid, but it worked, and I didn't know any better. I didn't even know how to properly setup backups.

I would say I stuck with Arch for at least a 6-8 months, but eventually decided, for my server at least, that I should run everything under Proxmox, which I still do. Proxmox is great. This time though, the actual servers would just rub Debian! Much more simple, stable, but outdated, but ultimately worked. 

My memory beyond that point is a little hazey, but I aimed to run all of my servers with Debian, and eventually had to use Windows for my Legion laptop, I do not miss it *at all*.

The idea of stability appealed to me, and that is where I decided to try Bazzite, after selling my Legion to a friend, to help fund the GPU for my current computer. I craved something that Just Worked, something that would be hard to break, and I wouldn't have to "waste" time tinkering with. This was solid, and got me by for a few months. Zero issues at all, other than the bugginess of the Steam overlay, which was incredibly inconsistent and I still fight to this day. Cmon Gabe.

Around this time, I recieved a free laptop, a Dell Pro 14, from a college scholarship program. It was wonderful, as I have been in need of something portable and with modest specs. But most importantly, free. Can't beat that :p

The laptop did not spend a single ***nanosecond*** on Windows. Straight to Bazzite it went. For... a little while. I realized I wanted something a bit more customizeable, and familiar, so after about a month I decided to give Debian a try. Worked great, but I wanted to switch things up a bit, GNOME, KDE, Cinnamon, none of them really appealed to me, I wanted something more customizeable, something a bit more lightweight, and most importantly, the aesthetics. Sway was my first choice. Simple, and does exactly what I needed it to do, launch Firefox. This worked perfect. I did not have any intentions of playing games on it, and one of my biggest fears of Linux was getting games to just.. work. Just as they did with Bazzite. I fought Linux Mint & Proton endlessly just to get games to run, even games that were native to Linux would freak out and shit the bed. 

One of the distrobutions I tinkered with during the Windows/Legion laptop era was NixOS, alongside Arch, Cachy, Linux Mint, and Debian. No clue what I did, but NixOS was *daunting*. I got a basic configuration working one evening, and it eventually just... broke? In hindsight I think it was my dumbass breaking the bootloader. I also, at the time, wasn't as good with Git, and I wanted to incorporate it into my Nix experiments at the time, not fun.

Eventually, I wanted to run Sway, on my Bazzite machine. Got tired of GNOME. KDE just irks me. Cinnamon is just... no. I had riced and cooked up my Sway configurations to perfection by this time, and wanted to run the same configuration as seamlessly as possible, it just felt right. 

I said fuck it, I am giving Arch a try again. Whats the worst that could go wrong? So I researched what exactly Bazzite was doing behind the scenes to make things just work, and from that, I learned how to build/use an alternate kernel, and optionally a scheduler, like BORE. CachyOS as the kernel, BORE, on Arch. It felt clean, but... over time it just felt like I was putting so much work into something that didn't really pay off like I wanted it to. Everything I did, I had to do on my Laptop too, or vice versa. It felt like a constant battle, and god forbid I switch devices or need to reinstall. I wanted something that I could spend time building, but also Just Worked. Obviously you can't have your cake and eat it too, but with NixOS, I found the perfect cake, one that I could eat the shit out of.

And eventually, in time, the road I was travelling eventually led to... NixOS.

...But why Nix?

I am going to put effort into my setups regardless, so why not make it as rewarding as possible? Whether it is just to sync two client devices, a few servers, or an entire fleet of machines, you will never have to worry about anything ever again! Need to reinstall? Everything is already defined. Did something break, you can just time travel, literally. It's great.
