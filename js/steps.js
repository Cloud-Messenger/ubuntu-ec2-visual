/* steps.js – lesson content for the nine steps (pure data, no DOM access). */
(function (root) {
  'use strict';
  var PUBLIC_IP = '203.0.113.25';   // documentation-range IP (RFC 5737) – never a real server
  var STEPS = [
    {
      n: 1, label: 'Launch EC2', icon: '☁️', title: 'AWS EC2: Launch Your Virtual Computer',
      story: 'Rent your own computer inside the AWS Cloud.',
      simple: 'EC2 lets you rent a computer from Amazon by the second. You pick the operating system (Ubuntu), the size (how much CPU and memory) and where it lives (a Region). A few clicks later, it is running.',
      technical: 'You launch an instance from an AMI (Amazon Machine Image) into a subnet of a VPC, in one Availability Zone. The instance type (for example t3.micro) fixes the vCPU count and memory. The root EBS volume is created from the AMI snapshot, and the key pair\'s public key is injected at first boot by cloud-init.',
      analogy: 'EC2 is a computer you rent instead of buying. AWS owns the hardware; you only pay while it runs.',
      concepts: [
        { t: 'What is EC2?', d: 'Elastic Compute Cloud: AWS\'s service for renting virtual machines (instances) on demand.' },
        { t: 'What is an AMI?', d: 'A template (OS + settings) used to create an instance. Here: Ubuntu Server 24.04 LTS published by Canonical.' },
        { t: 'What is an instance type?', d: 'A hardware recipe: vCPU, memory, network speed. t3.micro = 2 vCPU, 1 GiB RAM. Free-tier eligibility depends on your account and Region, so look for the "Free tier eligible" label.' },
        { t: 'What is a VPC?', d: 'Virtual Private Cloud: your private, isolated network inside AWS. Most accounts have a default VPC per Region.' },
        { t: 'What is a subnet?', d: 'A slice of the VPC\'s IP range that lives in exactly one Availability Zone.' },
        { t: 'What is an Availability Zone?', d: 'One or more isolated data centers inside a Region (e.g. ap-south-1a). Spread across AZs for resilience.' }
      ],
      commands: [{ c: 'aws ec2 describe-images --owners 099720109477 --filters "Name=name,Values=ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*" --query "sort_by(Images,&CreationDate)[-1].[ImageId,Name]" --output text', note: 'Optional: find the latest Ubuntu 24.04 AMI from the AWS CLI (099720109477 is Canonical\'s AWS account).' }],
      output: 'ami-0123456789abcdef0   ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-20250101',
      mistakes: ['Launching in the wrong Region, then not finding the instance later.', 'Choosing an AMI from an unknown publisher instead of Canonical.', 'Forgetting to download the .pem key (AWS only lets you download it once).', 'Leaving the instance running and being surprised by the bill.'],
      tip: 'Can\'t see your instance? Check the Region selector in the top-right of the console first.',
      interview: { q: 'What is the difference between an AMI and an instance?', a: 'An AMI is a read-only template. An instance is a running virtual machine created from it. One AMI can launch many instances.' }
    },
    {
      n: 2, label: 'AWS Hypervisor', icon: '🖥️', title: 'Virtualization & the AWS Hypervisor',
      story: 'One powerful physical server can run multiple isolated virtual computers.',
      simple: 'A big physical AWS server is split into several virtual computers. A thin software layer called a hypervisor gives each one its own slice of CPU, memory, disk and network, and keeps them from seeing each other.',
      technical: 'The hypervisor schedules vCPUs on physical cores, maps guest memory with hardware-assisted virtualization (Intel VT-x / AMD-V), and isolates guests. AWS has used different technologies by generation: older instance families (e.g. T2, M4) ran on a Xen-based hypervisor, while current-generation instances run on the AWS Nitro System. Nitro offloads networking (VPC), EBS storage and management to dedicated Nitro cards and uses a lightweight KVM-based Nitro hypervisor for CPU and memory. Bare-metal instances (*.metal) have no hypervisor between you and the hardware. So not every EC2 instance uses the same architecture.',
      analogy: 'Physical server = apartment building. Hypervisor = building management. Virtual machine = one apartment. Ubuntu = the tenant living inside.',
      concepts: [
        { t: 'Type 1 hypervisor', d: 'Runs directly on hardware ("bare metal"). Examples: VMware ESXi, Microsoft Hyper-V, Xen, KVM (a Linux kernel module, often classed as Type 1). Used in data centers.' },
        { t: 'Type 2 hypervisor', d: 'Runs as an app on top of a normal OS. Examples: Oracle VirtualBox, VMware Workstation, Parallels. Used on laptops and for learning.' },
        { t: 'AWS Nitro System', d: 'Dedicated Nitro cards handle VPC networking, EBS and security, a Nitro Security Chip protects the host, and a minimal hypervisor handles CPU/memory. Result: near bare-metal performance and stronger isolation.' },
        { t: 'Guest OS', d: 'The operating system inside the VM, here Ubuntu 24.04. It believes it owns the hardware; the hypervisor decides otherwise.' }
      ],
      commands: [{ c: 'curl -s http://169.254.169.254/latest/meta-data/instance-type', note: 'Ask the instance metadata service which type you are running (IMDSv2 may require a token; see the troubleshooting guide).' }, { c: 'lscpu | grep -i -E "hypervisor|model name"', note: 'Shows the hypervisor vendor seen from inside the guest.' }],
      output: 't3.micro\nHypervisor vendor:     KVM\nModel name:            Intel(R) Xeon(R) Platinum 8259CL CPU @ 2.50GHz',
      mistakes: ['Believing a vCPU is always a full physical core (on most x86 types it is a hardware thread).', 'Assuming every EC2 instance runs the same hypervisor.', 'Confusing Type 1 and Type 2 hypervisors.'],
      tip: 'Inside the VM, tools like lscpu or dmesg reveal the virtualization layer. Output differs by instance generation.',
      interview: { q: 'What is the AWS Nitro System?', a: 'A hardware-plus-software platform where dedicated Nitro cards offload networking, storage and management from the host CPU, with a lightweight hypervisor (or none, on bare-metal types), giving better performance and security isolation.' }
    },
    {
      n: 3, label: 'Instance Configuration', icon: '🔧', title: 'Configure Your EC2 Instance',
      story: 'Customize your virtual computer before moving in.',
      simple: 'Pick the size of your computer (CPU and memory), the size of its hard disk, the key that will unlock it, the network it lives in, and whether it gets a public address. Then it boots: Pending, then Running.',
      technical: 'Choose the family (t3 = burstable general purpose), vCPU and memory from the type, an EBS gp3 root volume (the Ubuntu AMI defaults to 8 GiB), a key pair, a VPC and subnet, and "auto-assign public IP". After launch the instance goes pending → running, then EC2 runs two status checks: system reachability (AWS host) and instance reachability (your OS).',
      analogy: 'Choosing a flat: how many rooms (vCPU), how much storage (EBS), which key opens the door, which street it is on (subnet), and whether it has a public street number.',
      concepts: [
        { t: 'What is a vCPU?', d: 'A virtual CPU: the unit of compute the hypervisor hands to your instance (usually one hardware thread).' },
        { t: 'What is RAM?', d: 'Fast working memory. t3.micro has 1 GiB, enough for NGINX and a static site.' },
        { t: 'What is EBS?', d: 'Elastic Block Store: network-attached virtual disks that survive stop/start and can be snapshotted.' },
        { t: 'What is a root volume?', d: 'The EBS volume holding the OS (mounted at / on Ubuntu). Deleted on termination by default.' },
        { t: 'What is a key pair?', d: 'A public/private key pair for SSH. AWS stores the public key; you keep the private .pem file.' },
        { t: 'What is a public IP?', d: 'An internet-routable IPv4 address mapped to your instance. The auto-assigned one changes on stop/start; an Elastic IP stays fixed. Public IPv4 addresses are billed, so check current AWS pricing.' }
      ],
      commands: [{ c: 'aws ec2 describe-instance-status --instance-ids i-0abc1234def567890 --query "InstanceStatuses[0].[InstanceState.Name,SystemStatus.Status,InstanceStatus.Status]" --output text', note: 'Check state and status checks from the CLI.' }],
      output: 'running   ok   ok',
      mistakes: ['Choosing an instance type too small for the workload.', 'Disabling auto-assign public IP, then wondering why there is no address to open.', 'Picking a subnet with no route to an internet gateway.', 'Using a key pair name but not owning the matching .pem file.'],
      tip: 'Status checks show "Initializing" for a couple of minutes after launch. Wait for 2/2 checks passed before connecting.',
      interview: { q: 'What happens to the public IP when you stop and start an instance?', a: 'An auto-assigned public IPv4 is released and a new one is assigned on start. Use an Elastic IP for a stable address.' }
    },
    {
      n: 4, label: 'Security Group', icon: '🔐', title: 'Security Group: Your Virtual Firewall',
      story: 'A security guard protects your cloud computer.',
      simple: 'A Security Group is a guest list for your server. Only the traffic you explicitly allow (SSH for you, HTTP for the world) gets in. Everything else is turned away.',
      technical: 'Security groups are stateful, allow-only firewalls attached to the instance\'s network interface. Inbound is denied by default; outbound is allow-all by default. Rules match protocol, port and source (a CIDR block such as 198.51.100.7/32 or another security group). Because they are stateful, reply traffic for an allowed request is automatically permitted. Network ACLs, by contrast, are stateless and subnet-level.',
      analogy: 'A security guard with a guest list. Say your name and you are in; replies leave freely because the guard remembers who came in.',
      concepts: [
        { t: 'Inbound rules', d: 'Control traffic coming to the instance (SSH, HTTP, HTTPS).' },
        { t: 'Outbound rules', d: 'Control traffic leaving the instance. Default: allow all.' },
        { t: 'Source IP / CIDR', d: 'Who may connect. /32 is exactly one IP; 0.0.0.0/0 is the entire internet.' },
        { t: 'Stateful firewall', d: 'Tracks connections: a response to an allowed request is allowed without an extra rule.' },
        { t: 'Least privilege', d: 'Open only what is needed, to only who needs it. SSH from your IP only, never 0.0.0.0/0.' }
      ],
      commands: [{ c: 'aws ec2 authorize-security-group-ingress --group-id sg-0abc1234 --protocol tcp --port 80 --cidr 0.0.0.0/0', note: 'Optional CLI equivalent of adding the HTTP rule in the console.' }],
      output: '{ "Return": true, "SecurityGroupRules": [ { "IpProtocol": "tcp", "FromPort": 80, "ToPort": 80, "CidrIpv4": "0.0.0.0/0" } ] }',
      rules: [
        { proto: 'SSH', port: '22', src: 'My IP (/32)', why: 'Remote administration' },
        { proto: 'HTTP', port: '80', src: '0.0.0.0/0', why: 'Public website access' },
        { proto: 'HTTPS', port: '443', src: '0.0.0.0/0', why: 'Secure website (needs TLS set up)' }
      ],
      mistakes: ['Opening SSH to 0.0.0.0/0.', 'Forgetting that your home IP can change, which locks you out.', 'Adding port 80 but expecting HTTPS to work (443 needs a certificate and NGINX TLS config).', 'Looking for a "deny" rule: security groups have only allow rules.'],
      tip: 'Timeout = usually a firewall silently dropping packets. "Connection refused" = firewall is open but nothing listens on that port.',
      interview: { q: 'Security Group vs Network ACL?', a: 'Security groups: instance-level, stateful, allow rules only. NACLs: subnet-level, stateless, allow and deny rules, evaluated in order.' }
    },
    {
      n: 5, label: 'SSH Connection', icon: '💻', title: 'Connect to Ubuntu Using SSH',
      story: 'Remotely enter your cloud computer.',
      simple: 'SSH is a secure tunnel to your server\'s command line. Your private key proves who you are, so no password travels over the internet.',
      technical: 'The client opens TCP port 22 to the instance\'s public IP. The SSH handshake negotiates encryption, the server presents its host key, and the client authenticates by signing a challenge with the private key. The server verifies it against the public key in ~ubuntu/.ssh/authorized_keys (installed by cloud-init at first boot). OpenSSH refuses key files readable by others, hence chmod 400.',
      analogy: 'Your private key is a house key; the public key is the lock on the door. You can copy the lock for everyone, but never the key.',
      concepts: [
        { t: 'What is SSH?', d: 'Secure Shell: an encrypted protocol for remote command-line access.' },
        { t: 'Public-key authentication', d: 'You prove possession of a private key without ever sending it.' },
        { t: 'What is a private key?', d: 'The secret half of the pair (key.pem). Anyone who has it can log in as you.' },
        { t: 'Why port 22?', d: 'SSH listens on TCP 22 by default; the Security Group must allow it from your IP.' },
        { t: 'Why never share private keys?', d: 'They are credentials. A leaked key gives full server access; rotate it immediately if exposed.' }
      ],
      commands: [{ c: 'chmod 400 key.pem', note: 'Restrict the key so only you can read it.' }, { c: 'ssh -i key.pem ubuntu@' + PUBLIC_IP, note: 'Connect. The default user on Ubuntu AMIs is ubuntu.' }],
      output: 'Welcome to Ubuntu 24.04 LTS (GNU/Linux 6.8.0-1018-aws x86_64)\n\nubuntu@ip-172-31-24-87:~$',
      mistakes: ['Wrong username (ec2-user is for Amazon Linux, not Ubuntu).', 'Key file permissions too open ("UNPROTECTED PRIVATE KEY FILE").', 'Port 22 not allowed from your current IP.', 'Using the instance\'s private IP from outside the VPC.'],
      tip: 'Use ssh -v for verbose logs. They show exactly where the connection stalls.',
      interview: { q: 'Why do we run chmod 400 on the key?', a: 'OpenSSH refuses to use a private key that other users can read, because shared keys are not secret. 400 means read-only for the owner.' }
    },
    {
      n: 6, label: 'Explore Ubuntu', icon: '🐧', title: 'Explore Ubuntu Linux',
      story: 'Explore your newly created cloud computer.',
      simple: 'You are now inside the server. Try the commands in the terminal below to see who you are, what files exist, how much memory and disk you have, and how the network is set up.',
      technical: 'Linux organizes everything under a single root directory (/). Your home is /home/ubuntu. The kernel manages CPU, memory and devices; /proc and tools like free, df, uptime read its counters. On Nitro instances the network interface is usually named ens5 and the root disk appears as an NVMe device.',
      analogy: 'The filesystem is a building directory: / is the lobby, /home are residents\' rooms, /etc is the settings office, /var holds logs and web content.',
      concepts: [
        { t: 'Linux filesystem', d: 'One tree starting at /. No drive letters.' },
        { t: 'Root directory (/)', d: 'The top of the tree. Not the same as the root user\'s home (/root).' },
        { t: 'Home directory', d: '/home/ubuntu: your personal space, shown as ~.' },
        { t: 'The ubuntu user', d: 'Default non-root admin user; uses sudo for privileged tasks.' },
        { t: 'Kernel', d: 'The core of the OS (uname -r shows its version, here an "-aws" tuned kernel).' },
        { t: 'CPU / memory / disk / network', d: 'Inspect with uptime (load), free -m (RAM), df -h (disk), ip addr (interfaces).' }
      ],
      commands: [{ c: 'whoami', note: '' }, { c: 'pwd', note: '' }, { c: 'ls -la', note: '' }, { c: 'uname -a', note: '' }, { c: 'cat /etc/os-release', note: '' }, { c: 'hostname', note: '' }, { c: 'df -h', note: '' }, { c: 'free -m', note: '' }, { c: 'uptime', note: '' }, { c: 'ip addr', note: '' }],
      output: 'ubuntu\n/home/ubuntu\nLinux ip-172-31-24-87 6.8.0-1018-aws x86_64 GNU/Linux',
      mistakes: ['Running everything as root instead of using sudo only when needed.', 'Deleting files with rm -rf without checking the path.', 'Reading "free" memory literally: look at "available".'],
      tip: 'Stuck? Type help in the simulated terminal, or click any command in the Command Explorer.',
      interview: { q: 'What does df -h show versus free -m?', a: 'df -h reports filesystem (disk) usage in human-readable units; free -m reports RAM and swap in megabytes.' }
    },
    {
      n: 7, label: 'Install NGINX', icon: '📦', title: 'Update Ubuntu and Install NGINX',
      story: 'Prepare your server to become a website hosting machine.',
      simple: 'Ubuntu has an app store for servers called APT. First refresh its catalog, apply updates, then install NGINX, the program that serves websites.',
      technical: 'apt update downloads package indexes from the configured repositories (on EC2, a Region-local Ubuntu mirror). apt upgrade installs newer versions of installed packages. apt install nginx resolves dependencies, downloads .deb files, unpacks them with dpkg, installs a systemd unit and starts the service. Ubuntu 24.04 ships NGINX 1.24.',
      analogy: 'APT is a supermarket delivery: update = read today\'s catalog, upgrade = replace old items, install = order NGINX and have it delivered and set up.',
      concepts: [
        { t: 'What is APT?', d: 'Ubuntu\'s command-line package manager (front end for dpkg).' },
        { t: 'Package manager', d: 'A tool that installs, updates and removes software with dependencies handled for you.' },
        { t: 'Repository', d: 'A server hosting packages plus a signed index (e.g. archive.ubuntu.com).' },
        { t: 'What is NGINX?', d: 'A fast web server and reverse proxy (pronounced "engine-x").' },
        { t: 'Why a web server?', d: 'Browsers speak HTTP. A web server listens on port 80/443 and answers with files.' }
      ],
      commands: [{ c: 'sudo apt update', note: '' }, { c: 'sudo apt upgrade -y', note: '' }, { c: 'sudo apt install nginx -y', note: '' }, { c: 'nginx -v', note: '' }],
      output: 'Hit:1 http://ap-south-1.ec2.archive.ubuntu.com/ubuntu noble InRelease\nReading package lists... Done\nSetting up nginx (1.24.0-2ubuntu7) ...\nnginx version: nginx/1.24.0 (Ubuntu)',
      mistakes: ['Skipping apt update, which causes "Unable to locate package".', 'Forgetting sudo ("Permission denied").', 'Running two apt processes at once (lock error).', 'Running out of disk space mid-install.'],
      tip: '"Could not get lock /var/lib/dpkg/lock": another apt process (often unattended-upgrades right after boot) is running. Wait a minute and retry.',
      interview: { q: 'apt update vs apt upgrade?', a: 'update refreshes the list of available packages; upgrade installs newer versions of what is already installed.' }
    },
    {
      n: 8, label: 'Host Website', icon: '🌐', title: 'Host Your Netflix-Inspired Website',
      story: 'Your cloud computer becomes a live website server!',
      simple: 'Copy your website files into the folder NGINX serves, make sure port 80 is open in the Security Group, then open http:// plus your public IP in a browser. The page you see comes from your own server.',
      technical: 'NGINX\'s default site serves files from /var/www/html (root directive in /etc/nginx/sites-available/default) and tries index.html before index.nginx-debian.html. The browser sends GET / over TCP 80, the packet passes the internet gateway and Security Group, reaches NGINX on the instance, which reads index.html and returns an HTTP 200 response with HTML that references style.css and script.js. HTTPS (443) additionally requires a TLS certificate and server configuration.',
      analogy: 'NGINX is the restaurant waiter: a visitor asks for the page (order), the waiter fetches the file from the kitchen (/var/www/html) and brings it back.',
      concepts: [
        { t: 'Document root', d: '/var/www/html is where NGINX looks for files by default.' },
        { t: 'HTTP request/response', d: 'Browser: GET / → NGINX: 200 OK + HTML. Follow-up requests fetch CSS, JS and images.' },
        { t: 'systemctl', d: 'Controls services: enable (start at boot), start/stop/restart, status.' },
        { t: 'HTTPS needs more', d: 'Port 443 open in the Security Group is not enough: you need a certificate (e.g. Let\'s Encrypt via certbot) and an NGINX TLS server block, plus a domain name.' }
      ],
      commands: [{ c: 'sudo systemctl enable --now nginx', note: '' }, { c: 'sudo systemctl status nginx', note: '' }, { c: 'sudo cp -r website/* /var/www/html/', note: 'Run from the folder containing your website/ directory.' }, { c: 'curl http://localhost', note: '' }, { c: 'http://' + PUBLIC_IP, note: 'Open this in your browser (use http://, not https://).' }],
      output: '<!DOCTYPE html>\n<html lang="en">\n<head>\n<title>CloudFlix – Demo Streaming Landing Page</title>',
      mistakes: ['Port 80 not allowed in the Security Group.', 'Typing https:// when only HTTP is configured.', 'Copying the folder itself, creating /var/www/html/website/index.html instead of /var/www/html/index.html.', 'Leaving wrong permissions so NGINX gets 403.'],
      tip: 'Test in layers: curl http://localhost on the server first. If that works, the problem is outside NGINX (usually the Security Group or IP).',
      interview: { q: 'Where does NGINX serve files from by default on Ubuntu?', a: '/var/www/html, set by the root directive in /etc/nginx/sites-available/default (symlinked into sites-enabled).' }
    },
    {
      n: 9, label: 'Troubleshooting', icon: '🚀', title: 'Troubleshooting & Production Verification',
      story: 'Become a Cloud Support Engineer and troubleshoot your own server!',
      simple: 'Things break. Pick an incident, run the diagnostic, apply the fix, and verify. When everything is green, your server is healthy.',
      technical: 'Troubleshoot layer by layer: AWS (instance state, Security Group, IP) → network (port reachability) → OS (disk, memory, services) → application (NGINX config, files, permissions). Each layer has a signature: timeout (firewall), refused (nothing listening), 403 (permissions), default page (wrong files).',
      analogy: 'Like a doctor: check symptoms, run a test, treat the cause, then confirm the patient is better.',
      concepts: [
        { t: 'Timeout vs refused', d: 'Timeout: packets dropped (firewall / wrong IP / stopped). Refused: host reachable but no listener.' },
        { t: 'Work outside-in or inside-out', d: 'From the server: curl localhost. From outside: curl the public IP. Compare results.' },
        { t: 'Logs', d: 'journalctl -u nginx and /var/log/nginx/error.log tell you what NGINX saw.' }
      ],
      commands: [{ c: 'sudo systemctl status nginx', note: '' }, { c: 'sudo systemctl restart nginx', note: '' }, { c: 'sudo nginx -t', note: '' }, { c: 'sudo journalctl -u nginx -n 50', note: '' }, { c: 'curl -I http://localhost', note: '' }, { c: 'df -h', note: '' }, { c: 'free -m', note: '' }, { c: 'ss -tulpn', note: '' }],
      output: 'nginx: the configuration file /etc/nginx/nginx.conf syntax is ok\nnginx: configuration file /etc/nginx/nginx.conf test is successful',
      mistakes: ['Changing many things at once, so you never learn the cause.', 'Restarting NGINX without running nginx -t first.', 'Forgetting that SG changes apply immediately but NGINX config changes need a reload.'],
      tip: 'Always run sudo nginx -t before reload or restart. It prevents taking a working site down.',
      interview: { q: 'A website times out but curl http://localhost works on the server. What is wrong?', a: 'The web server is fine. Something between the internet and the instance is blocking: most likely the Security Group (port 80), a NACL, a wrong IP, or no public IP/route.' }
    }
  ];
  root.STEPS = STEPS;
  root.PUBLIC_IP = PUBLIC_IP;
})(typeof window !== 'undefined' ? window : globalThis);
