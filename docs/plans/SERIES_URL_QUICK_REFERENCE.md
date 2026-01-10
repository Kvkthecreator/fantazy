# Series URL Quick Reference

> **Last Updated**: 2026-01-10
> **Purpose**: Fast lookup of series slugs for marketing campaigns

---

## 🔗 Current Active Series URLs

### Featured Series (Priority for Ads)

| **The Villainess Survives** | `villainess-survives` | `ep-0.com/series/villainess-survives` | Otome Isekai | TikTok, Reddit r/OtomeIsekai |
| **Seventeen Days** | `seventeen-days` | `ep-0.com/series/seventeen-days` | Mystery | Reddit r/manhwa, r/sololeveling |
| **K-Pop Boy Idol** | `k-pop-boy-idol` | `ep-0.com/series/k-pop-boy-idol` | Romantic Tension | TikTok, Twitter K-pop fans |
| **Hometown Crush** | `hometown-crush` | `ep-0.com/series/hometown-crush` | Romance | General romance campaigns |

---

## 📝 How to Get Series Slugs

### Method 1: Web UI (Easiest)
1. Go to `ep-0.com/dashboard` (must be logged in)
2. Click "Discover" or browse series cards
3. Click any series
4. Copy the slug from URL: `ep-0.com/series/[THIS-IS-THE-SLUG]`

### Method 2: API Call
```bash
curl -s 'https://api.ep-0.com/series?status=active' | \
  python3 -c "import json, sys; \
  data = json.load(sys.stdin); \
  print('\n'.join(f'{s[\"title\"]:<40} {s[\"slug\"]}' for s in data))"
```

### Method 3: Database (Direct Access)
```sql
SELECT
  title,
  slug,
  genre,
  total_episodes,
  is_featured
FROM series
WHERE status = 'active'
ORDER BY is_featured DESC, title;
```

---

## 🎯 Campaign-to-URL Mapping

### TikTok Campaigns

**Otome Isekai Content**:
```
Series: The Villainess Survives
URL: ep-0.com/series/villainess-survives
Hook: "You wake up as Lady Verlaine"
```

**K-pop Idol Romance**:
```
Series: K-Pop Boy Idol
URL: ep-0.com/series/k-pop-boy-idol
Hook: "Midnight burn with your idol bias"
```

### Reddit Campaigns

**r/OtomeIsekai, r/otomegames**:
```
Series: The Villainess Survives
URL: ep-0.com/series/villainess-survives
Headline: "Transmigrated as the villainess. Now what?"
```

**r/manhwa, r/sololeveling**:
```
Series: Seventeen Days
URL: ep-0.com/series/seventeen-days
Headline: "17 days to solve the mystery"
```

### Twitter Campaigns

**K-drama/K-pop Fans**:
```
Series: K-Pop Boy Idol
URL: ep-0.com/series/k-pop-boy-idol
Ad: Character image with "He's not just on your screen anymore"
```

---

## ✅ Checklist Before Posting

Before posting ANY ad or TikTok with a link:

- [ ] Use series-specific URL (not homepage)
- [ ] Test URL in incognito (should load without login)
- [ ] Verify series cover image appears
- [ ] Verify "Episode 0 — Free" badge shows
- [ ] Check Episode 0 "Start Free" button visible

---

## 🚫 Common Mistakes to Avoid

| ❌ Wrong | ✅ Right |
|---------|---------|
| `ep-0.com` | `ep-0.com/series/villainess-survives` |
| `ep-0.com/discover` | `ep-0.com/series/villainess-survives` |
| `ep-0.com/series/the-villainess-survives` | `ep-0.com/series/villainess-survives` |
| Using title as slug | Using actual slug from API/DB |

**Remember**: The slug may differ from the title!
- Title: "The Villainess Survives"
- Slug: `villainess-survives` (simplified)

---

## 📊 Series Performance Tracking

### How to Track Which Series Convert

**UTM Parameters** (add to URL):
```
ep-0.com/series/villainess-survives?utm_source=tiktok&utm_campaign=oi-villainess-jan10
```

**Track in Analytics**:
1. Pageviews by series slug
2. Signup rate by series
3. Activation rate by series
4. Time on page by series

**Identify Winners**:
- Series with highest signup rate
- Series with highest activation rate
- Series with lowest bounce rate

---

## 🎬 Creating New Series URLs

When a new series is published:

1. **Get the slug** (from API or Studio)
2. **Test the URL**: `ep-0.com/series/[new-slug]`
3. **Verify public access**: Open in incognito mode
4. **Add to this document**: Update table above
5. **Create marketing assets**: Match series visuals/tone

---

## 📞 Quick Commands

**List all active series**:
```bash
curl -s 'https://api.ep-0.com/series?status=active' | jq '.[] | {title, slug, genre}'
```

**Check if slug exists**:
```bash
curl -s "https://api.ep-0.com/series?status=active" | jq '.[] | select(.slug=="villainess-survives")'
```

**Test series page** (should return HTML):
```bash
curl -I https://ep-0.com/series/villainess-survives
# Should return: HTTP/2 200
```

---

## 🔄 Update Frequency

**Update this document when**:
- New series is published
- Series slug changes
- New campaign launches
- Series is archived/unpublished

**Check for updates**: Start of each week or before major campaign launch

---

## 🎯 For Future Reference

**When creating TikTok videos**:
1. Film series-specific content
2. Get series slug from this doc
3. Add link to bio: `ep-0.com/series/[slug]`
4. Test link before posting

**When creating Reddit ads**:
1. Match series to subreddit (otome isekai → r/OtomeIsekai)
2. Get series slug from this doc
3. Set destination URL: `ep-0.com/series/[slug]`
4. Add UTM parameters for tracking

**When creating Twitter ads**:
1. Series-specific character visuals
2. Get series slug from this doc
3. Link card URL: `ep-0.com/series/[slug]`
4. Test in incognito before launching

---

**Remember**: Always use series-specific URLs. Never link to homepage for series-specific content!
