import { Request, Response } from 'express'
import { activityService } from '../services/activity.service.js'
import { UnauthorizedError } from '../utils/errors.js'

/**
 * Activity Log controller - handles HTTP requests/responses for activity logs
 */
export const activityController = {
  /**
   * Get current user's activity logs
   */
  async getMyLogs(req: Request, res: Response) {
    const userId = (req as any).userId
    if (!userId) {
      throw new UnauthorizedError('Authentication required')
    }

    const limit = parseInt(req.query.limit as string) || 100
    const offset = parseInt(req.query.offset as string) || 0

    const logs = await activityService.getUserLogs(userId, limit, offset)
    res.json({ data: logs })
  },

  /**
   * Get activity logs for a specific resource
   */
  async getResourceLogs(req: Request, res: Response) {
    const { resourceType, resourceId } = req.params
    const limit = parseInt(req.query.limit as string) || 100

    const logs = await activityService.getResourceLogs(resourceType, resourceId, limit)
    res.json({ data: logs })
  },

  /**
   * Get recent activity logs (admin only - can be restricted later)
   */
  async getRecentLogs(req: Request, res: Response) {
    const limit = parseInt(req.query.limit as string) || 100

    const logs = await activityService.getRecentLogs(limit)
    res.json({ data: logs })
  },

  /**
   * Get userlog.json formatted data
   */
  async getUserLog(req: Request, res: Response) {
    const formattedData = activityService.getUserLogFromFile()
    if (!formattedData) {
      return res.status(404).json({ error: 'User log file not found' })
    }
    res.json(formattedData)
  },

  /**
   * Get userlog.json formatted data as HTML
   */
  async getUserLogHtml(req: Request, res: Response) {
    const formattedData = activityService.getUserLogFromFile()
    if (!formattedData) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>User Log - Not Found</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 2rem; text-align: center; }
            h1 { color: #dc2626; }
          </style>
        </head>
        <body>
          <h1>User Log Not Found</h1>
          <p>The userlog.json file does not exist.</p>
        </body>
        </html>
      `)
    }

    const { summary, allActivities } = formattedData
    
    // Generate HTML
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>User Activity Log</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f9fafb;
      color: #111827;
      padding: 2rem;
      line-height: 1.6;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    header {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      margin-bottom: 2rem;
    }
    h1 {
      font-size: 2rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #111827;
    }
    .subtitle {
      color: #6b7280;
      font-size: 0.875rem;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .stat-label {
      font-size: 0.875rem;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }
    .stat-value {
      font-size: 2rem;
      font-weight: 600;
      color: #111827;
    }
    .breakdown {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      margin-bottom: 2rem;
    }
    .breakdown h2 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: #111827;
    }
    .breakdown-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
    }
    .breakdown-item {
      padding: 0.75rem;
      background: #f9fafb;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .breakdown-label {
      font-weight: 500;
      color: #374151;
    }
    .breakdown-count {
      background: #3b82f6;
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.875rem;
      font-weight: 600;
    }
    .activities {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .activities h2 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: #111827;
    }
    .activity-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .activity-item {
      padding: 1rem;
      background: #f9fafb;
      border-radius: 6px;
      border-left: 4px solid #3b82f6;
      transition: background 0.2s;
    }
    .activity-item:hover {
      background: #f3f4f6;
    }
    .activity-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.5rem;
    }
    .activity-time {
      font-size: 0.875rem;
      color: #6b7280;
      font-family: 'Monaco', 'Menlo', monospace;
    }
    .activity-type {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .activity-type.auth { background: #fef3c7; color: #92400e; }
    .activity-type.writing { background: #dbeafe; color: #1e40af; }
    .activity-type.view { background: #e0e7ff; color: #3730a3; }
    .activity-type.appreciation { background: #fce7f3; color: #9f1239; }
    .activity-type.comment { background: #d1fae5; color: #065f46; }
    .activity-description {
      font-weight: 500;
      color: #111827;
      margin-bottom: 0.25rem;
    }
    .activity-user {
      font-size: 0.875rem;
      color: #6b7280;
    }
    .activity-user.anonymous {
      font-style: italic;
      color: #9ca3af;
    }
    .footer {
      text-align: center;
      margin-top: 2rem;
      padding: 1rem;
      color: #6b7280;
      font-size: 0.875rem;
    }
    .json-link {
      display: inline-block;
      margin-top: 1rem;
      padding: 0.5rem 1rem;
      background: #3b82f6;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-size: 0.875rem;
      transition: background 0.2s;
    }
    .json-link:hover {
      background: #2563eb;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>User Activity Log</h1>
      <p class="subtitle">Activity tracking and analytics</p>
      <a href="/api/activity/userlog" class="json-link">View JSON Format</a>
    </header>

    <div class="stats">
      <div class="stat-card">
        <div class="stat-label">Total Activities</div>
        <div class="stat-value">${summary.totalActivities}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Unique Users</div>
        <div class="stat-value">${summary.uniqueUsers}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Anonymous Activities</div>
        <div class="stat-value">${summary.anonymousActivities}</div>
      </div>
    </div>

    <div class="breakdown">
      <h2>Activity Breakdown</h2>
      <div class="breakdown-grid">
        ${Object.entries(summary.activityBreakdown).map(([type, count]) => `
          <div class="breakdown-item">
            <span class="breakdown-label">${type}</span>
            <span class="breakdown-count">${count}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="breakdown">
      <h2>Action Breakdown</h2>
      <div class="breakdown-grid">
        ${Object.entries(summary.actionBreakdown).map(([action, count]) => `
          <div class="breakdown-item">
            <span class="breakdown-label">${action}</span>
            <span class="breakdown-count">${count}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="activities">
      <h2>All Activities (${allActivities.length})</h2>
      <div class="activity-list">
        ${allActivities.map((activity: any) => `
          <div class="activity-item">
            <div class="activity-header">
              <span class="activity-type ${activity.activityType}">${activity.activityType}</span>
              <span class="activity-time">${activity.timestamp}</span>
            </div>
            <div class="activity-description">${activity.description}</div>
            ${activity.userId ? `
              <div class="activity-user">User: ${activity.userId.substring(0, 8)}...</div>
            ` : `
              <div class="activity-user anonymous">Anonymous user</div>
            `}
          </div>
        `).join('')}
      </div>
    </div>

    <div class="footer">
      <p>Generated at ${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>
    `

    res.setHeader('Content-Type', 'text/html')
    res.send(html)
  }
}
