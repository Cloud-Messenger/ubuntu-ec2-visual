# Architecture

## 1. The learning architecture (what the simulator draws)

```text
Visitor browser
   │  HTTP GET /
   ▼
Internet ──► Public IPv4 ──► Security Group (22 / 80 / 443)
                                  │ allowed
                                  ▼
                     EC2 instance · Ubuntu 24.04 LTS (t3.micro)
                                  │
                                  ▼
                         NGINX :80  ──►  /var/www/html
                                          index.html · style.css · script.js · assets/
```

Placement: **AWS Region ▸ Availability Zone ▸ VPC subnet ▸ ENI ▸ instance**; root volume = **EBS (gp3)**.

## 2. Virtualization, accurately

| Layer | Responsibility |
|---|---|
| Physical host | CPU, RAM, NVMe, NICs in an AWS data center |
| Hypervisor | Schedules vCPUs, maps memory, isolates guests |
| Guest VM | Your Ubuntu kernel + user space |

**Type 1** hypervisors run directly on hardware (e.g. Xen, KVM, VMware ESXi, Hyper-V). **Type 2** hypervisors run as an application on a host OS (e.g. VirtualBox, VMware Workstation).

**AWS does not use one single virtualization technology for every instance:**

- **Older generations** (for example T2, M4) are based on **Xen**.
- **Current generations** (for example T3, M5 and newer) run on the **AWS Nitro System**: dedicated **Nitro Cards** offload VPC networking, EBS and instance storage; a **Nitro Security Chip** protects hardware/firmware; and a **lightweight, KVM-based Nitro Hypervisor** handles mainly CPU and memory isolation.
- **`.metal` instances** give direct access to the server with no hypervisor between you and the hardware.

The simulator shows the Nitro-style stack for Step 2 and explicitly labels the differences.

## 3. Code architecture

```text
index.html ── loads ──► js/steps.js          lesson data (pure data, window.STEPS)
                        js/animation.js      SVG scenes + beat/packet engine (window.Anim)
                        js/terminal.js       simulated shell (window.Terminal)
                        js/troubleshooting.js 12 incidents (window.Troubleshoot)
                        js/app.js            UI controller: sidebar, autoplay, caption, preview, theme, finale
css/style.css          layout, tokens (dark/light), components
css/animation.css      SVG classes + keyframes
css/responsive.css     tablet / mobile
assets/website/        CloudFlix demo site (also the thing you deploy to NGINX)
```

**Animation engine.** Each scene is a function returning an SVG string plus a list of *beats*. Elements carry `data-beat="n"` (appear once beat ≥ n) or `data-at="n"` (highlight at beat n). A timer advances beats; packets (`.pkt`) follow SVG paths using `getPointAtLength` inside one `requestAnimationFrame` loop. Autoplay (5 s per step) lives in `app.js`.

**Health model.** `Anim.setHealth()` colors the six control-room tiles (EC2, SSH, Ubuntu, NGINX, HTTP 80, Website). The Website Preview card reads the same state: green → CloudFlix, warning → default NGINX page, red → “site can’t be reached”.

## 4. Simulation vs reality

Nothing here calls AWS. No credentials are requested or stored. Terminal output is canned and slightly state-aware (e.g. `nginx` is “not found” until you run the install). IDs, timestamps and kernel versions are examples. `203.0.113.25` is a documentation-range address (RFC 5737).
