---
title: How to expose a Minecraft server behind a Reverse Proxy
date: 2026-08-13
description: Hide your IP, bypass CG-NAT restrictions, and maybe learn something along the way.
---

# Preface

Before we begin, one needs to make sure that they actually benefit, need, or can generally make use of a reverse proxy for their Minecraft server. The software used in this tutorial may be used for far more than just Minecraft. We will be using [FRP](https://github.com/fatedier/frp). FRP can be used for just about any gameserver, or even websites, so hopefully the appeal here is beyond just the Craft.

Questions to ask yourself:
- Do you already self-host? If not, are you planning on it?
\ if you said yes to either of these, we can proceed.

Before digging any deeper, here are easier, free, and potentially more ideal options, depending on your usecase.

[Playit](https://playit.gg/) is a free* service that allows one to easily setup a tunnel to allow people to join. Contains premium features, may not have ideal latency. Ideal for a simple, free* setup for a dedicated server.
[e4mc](https://modrinth.com/mod/e4mc/versions) is an open source Fabric/Forge/Neoforge/Quilt mod that allows one to open their LAN game to allow people to join. Ideal for non-dedicated servers, or temporary play sessions.
[Tailscale](https://tailscale.com/) is a free* application to create VPN connections between machines. Very generous free tier. All players will need to install this in order to connect to the server. 

That being said, there are many ways to accomplish the goal of allowing people to join a server, all three of the aforementioned methods are entirely valid, but from my experience, using [FRP](https://github.com/fatedier/frp) has been the most stable, and flexible option.


## Prerequisites

- Basic understanding of networking
- Basic understanding of Linux
- A publicly accessible server. Such as a VPS, AWS instance, Oracle Cloud instance, etc.
- A Minecraft server running on another machine, self-hosted or otherwise.

This guide will only touch on the actual meat and potatoes of setting up FRP itself. It will not guide you on how to set up the server itself, security, etc. Here be dragons.

## Public server options

This is not sponsored, this is just me speaking from experience. 

Using Oracle's OCI, one can use an 'always-free' 1GB RAM instance. It is by no means powerful, but for what we need, it is just fine. A credit card is required to make an account, and it's... Oracle. Free though!
Using a cheap VPS provider, be that RackNerd's yearly deals(my personal solution), Vultr (Make sure it has a public IP) or a provider such as Lagless Xeon VPS ($3-4/mo).

Make sure to use a server that is geographically close to you, to improve the overall ping. You wouldn't want to use a EU hosted machine to proxy your server in the US. Aim for the same state/side of the country if possible.

Once you have acquired a public server, have secured it, and have root access to it, then we can begin with the actual fun!

## Softwares needed

At minimum, just FRP is required. FRPC on the machine that has the Minecraft server, and FRPS on the publicly accessible machine.

To ease the process for the installation, maintenance, and general quality of life, we will be leveraging [Tailscale]() & [Docker]() for this guide.
Tailscale simplifies the networking. Simply install Tailscale onto both machines, use the same account and put them on the same Tailnet. Each machine will have a Tailscale IP ``100.x.x.x`` that can be used in place of the real IP. This bypasses the need to port forward the self-hosted Minecraft server so that the publicly accessible server can reach it. This should help in situations for people cucked by CG-NAT.

Docker is entirely optional here. But, it makes setting up the server a *breeze*. Just populate a single file with gabbledeegook and you're 90% of the way there. No need to use the binary with something like tmux or byobu, no need to set up a service either. Best part too, its portable.

Again, both will be used for this guide. Enough context should be provided by this guide to assist one if they prefer not to use Docker/Tailscale.

To reiterate:
- FRP on both machines
- Tailscale on both machines
- Docker on both machines

## Public server setup prerequisites

We will start with the publicly accessible server. To begin, install Docker and Tailscale. Run the following. (Sanity check the following official documentation, you don't have to trust me) :%s/publically/publicly/g

[Tailscale Install](https://tailscale.com/download) // [Docker Install](https://get.docker.com/)

```
curl -fsSL https://tailscale.com/install.sh | sh
```
```
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

Done.

## Self-hosted server setup prerequisites

Now for the self-hosted machine. Run the same commands.


```
curl -fsSL https://tailscale.com/install.sh | sh
```
```
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

## Both servers at the same time, setup Tailscale

Now that both machines have the prerequisite software, it is time to install and authenticate with Tailscale. First, make sure you have an account already, or are ready to make a new one when prompted.

Run:

```
sudo tailscale up
```

That's it. Navigate to the link it spits out, and authenticate. Repeat for both machines. Note down both of their respective Tailscale IP addresses. ie. ``100.123.45.239``

Next, Docker.

On the public server, FRPS is needed. FRP 'server'.

To create the Docker container that will define and setup the FRPS container, first navigate to the folder for them to live. This can be anywhere, for simplicity, let's use ``/opt/docker``

Run:

```
mkdir -p /opt/docker/frps
```

Navigate to that directory:

```
cd /opt/docker/frps
```

From within that directory, create a ``compose.yml`` file.

Run:

```
nano compose.yml
```

Within that file, paste the contents of the compose, provided below. Change the needed values before proceeding.

```
services:
  frps:
    image: nykma/frp:0.58.0 # This is a pinned version, check latest image version 
    restart: always
    volumes:
      - ./config:/frp/config
      - ./log:/frp/log
    ports:
      - 25565:25565     # Minecraft server port, same as defined in the server.properties
      - 7000:7000       # FRPS Bind Port, same as the frps.toml
    entrypoint:
      - '/frp/frps'
      - '-c'
      - '/frp/frps.toml'

```

Then, run the compose to generate the configuration folder. The compose tells it to create that folder in the same folder as the ``compose.yml``.

Start it with:

```
sudo docker compose up -d
```

Navigate into the configuration folder.

```
cd config/
```

From there, edit/create the ``frps.toml``

```
nano frps.toml
```

Within that file, edit the template and paste it in.

```
bindPort = 7000 # For FRP, match with the compose
auth.method = "token" # this defines that we will use a password for establishing the connection with frp
auth.token = "hunter2" # a password
```

Close, save, and navigate back to the compose folder, and give it a full reboot:

```
cd ..

sudo docker compose up -d --force-recreate
```

Optionally, you can populate the config before ever setting it up, so this may be redundant.

To finish up the setup for the public server, you will need to configure your firewall. For simplicity, use [UFW](https://linuxconfig.org/how-to-install-and-use-ufw-firewall-on-linux)

Run:

```
sudo ufw allow 25565/tcp

sudo ufw allow 7000/tcp 

sudo ufw enable

sudo ufw status

```

The public server should be good to go. Proceed with setting up the local server.

On the local server, repeat the docker compose steps, except, use this as the compose contents:

```
services:
  frpc:
    image: nykma/frp:0.58.0 # Make sure to test the latest image. This is several builds behind.
    restart: always
    volumes:
      - ./config:/frp/config
    entrypoint:
      - '/frp/frpc'
      - '-c'
      - '/frp/frpc.toml'
```

Same deal. It will create a config/ folder in the same folder as the compose. Populate the ``frpc.toml`` inside of config/

```
cd config/

nano frpc.toml
```

Edit the following template, and paste it in.

```
serverAddr = "YOUR_FRPS_IP"   # VPS IP, tailscale or public
serverPort = 7000             # FRP bind port, same as the one opened on the firewall

auth.method = "token"
auth.token = "hunter2"   # same as frps

[[proxies]]
name = "minecraft"
type = "tcp"
localIP = "tailscale ip of mc server"
localPort = 25565
remotePort = 25565
```

Done. Run ``docker compose up -d`` and you should be balling.

That's really it. It honestly shouldn't take longer than 20 minutes. Next we will go over some common pitfalls.

## Pitfalls

If the Minecraft server is also running in Docker, make sure to verify the network settings if issues occur. Easiest solution is to set the container to use host networking, or to add frpc to the same compose as the minecraft server, and use a docker network, pick your poison.

If you are having issues, never be afraid to email me. Contact information is provided above.
