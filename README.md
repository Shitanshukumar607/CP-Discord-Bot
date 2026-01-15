# CP Verification Bot 🤖

A Discord bot that verifies ownership of Codeforces and CodeChef accounts using a Compilation Error verification mechanism.

## 🎯 Features

- **Account Verification**: Verify CP account ownership by submitting a Compilation Error
- **Multi-Platform Support**: Works with Codeforces and CodeChef
- **Multiple Accounts**: Users can link multiple CP accounts
- **Role Assignment**: Automatic role assignment upon verification
- **Codeforces Ranks**: Map Codeforces ranks to Discord roles (newbie → @Newbie, etc.)
- **Persistent Storage**: Uses Supabase for reliable data storage
- **10-Minute Window**: Users have 10 minutes to complete verification

## 🔧 How It Works

1. User runs `/link codeforces <username>` or `/link codechef <username>`
2. Bot assigns a random problem and stores the verification request
3. User submits any code that causes a **Compilation Error** to that problem
4. User runs `/verify` to complete the verification
5. Bot checks for CE submission and assigns roles

## 📋 Commands

| Command                          | Description                        |
| -------------------------------- | ---------------------------------- |
| `/link codeforces <username>`    | Start Codeforces verification      |
| `/link codechef <username>`      | Start CodeChef verification        |
| `/link status`                   | View your linked accounts          |
| `/verify`                        | Complete pending verifications     |
| `/setup verified-role <role>`    | Set the verified role (Admin)      |
| `/setup rank-role <rank> <role>` | Map CF rank to role (Admin)        |
| `/setup view`                    | View current configuration (Admin) |

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [Supabase](https://supabase.com/) account (free tier works)
- Discord Bot Application

### 1. Clone & Install

```bash
cd cp-bot
npm install
```

### 2. Create Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and name it
3. Go to "Bot" section and click "Add Bot"
4. Copy the **Token** (keep it secret!)
5. Enable these Privileged Gateway Intents:
   - Server Members Intent
6. Go to "OAuth2" → "URL Generator"
7. Select scopes: `bot`, `applications.commands`
8. Select permissions: `Manage Roles`, `Send Messages`, `Use Slash Commands`
9. Copy the generated URL and invite the bot to your server

### 3. Setup Supabase

1. Create a new project at [supabase.com](https://supabase.com/)
2. Go to "SQL Editor"
3. Copy and paste the contents of `supabase-schema.sql`
4. Click "Run" to create all tables
5. Go to "Settings" → "API"
6. Copy:
   - Project URL
   - `anon` public key

### 4. Configure Environment

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VERIFICATION_TIMEOUT=10
```

### 5. Deploy Commands

```bash
npm run deploy
```

For faster testing (guild-specific):

```bash
node src/deploy-commands.js --guild YOUR_GUILD_ID
```

### 6. Start the Bot

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

## ⚙️ Configuration

### Setting Up Roles (Admin)

1. **Set Verified Role** (assigned to all verified users):

   ```
   /setup verified-role @Verified
   ```

2. **Map Codeforces Ranks** to Discord roles:

   ```
   /setup rank-role newbie @Newbie
   /setup rank-role pupil @Pupil
   /setup rank-role specialist @Specialist
   /setup rank-role expert @Expert
   /setup rank-role candidate master @Candidate Master
   /setup rank-role master @Master
   ```

3. **View Configuration**:
   ```
   /setup view
   ```

## 📁 Project Structure

```
cp-bot/
├── src/
│   ├── commands/
│   │   ├── setup.js          # Admin configuration
│   │   ├── link.js           # Account linking
│   │   └── verify.js         # Verification completion
│   ├── services/
│   │   ├── supabase.client.js    # Database operations
│   │   ├── codeforces.service.js # Codeforces API
│   │   └── codechef.service.js   # CodeChef API
│   ├── utils/
│   │   ├── roleManager.js    # Role assignment logic
│   │   ├── randomProblem.js  # Problem selection
│   │   └── time.js           # Time utilities
│   ├── index.js              # Bot entry point
│   └── deploy-commands.js    # Command registration
├── supabase-schema.sql       # Database schema
├── package.json
├── .env.example
└── README.md
```

## 🗄️ Database Schema

### Tables

- **guild_config**: Server-specific settings (verified role, rank mappings)
- **pending_verifications**: Active verification sessions
- **linked_accounts**: Verified CP accounts

## 🔒 Security

- Bot token is stored in environment variables
- Supabase Row Level Security (RLS) enabled
- Admin commands require `ADMINISTRATOR` permission
- Verification sessions expire after 10 minutes

## 🌐 Hosting

### Free 24/7 Hosting Options

1. **Railway** - Easy deployment with GitHub integration
2. **Render** - Free tier with auto-sleep (may have cold starts)
3. **Fly.io** - Generous free tier
4. **Oracle Cloud** - Free VPS (Always Free tier)

### Railway Deployment

1. Connect your GitHub repo to Railway
2. Add environment variables in Railway dashboard
3. Deploy!

## 🐛 Troubleshooting

### Bot doesn't respond to commands

- Run `npm run deploy` to register commands
- Wait up to 1 hour for global commands to propagate
- Use guild-specific deployment for instant testing

### "Missing Access" error

- Ensure bot has "Manage Roles" permission
- Bot's role must be higher than roles it assigns

### Verification not working

- Check if the user submitted to the correct problem
- Ensure submission verdict is "Compilation Error"
- Verify submission was made after `/link` was run

### Supabase connection errors

- Check your `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- Ensure tables are created (run the SQL schema)

## 📝 API Notes

### Codeforces

- Official API with good documentation
- Rate limit: ~5 requests/second
- All submission verdicts are reliable

### CodeChef

- No official public API
- Uses web scraping for verification
- May be less reliable during contests

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## 📄 License

MIT License - feel free to use this bot for your Discord server!

---

**Made with ❤️ for competitive programmers**
