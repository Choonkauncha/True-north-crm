import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

async function requireAdmin() {
  const session = await getSession()
  return session?.role === 'admin' ? session : null
}

export async function GET(_req: NextRequest) {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

    const [employees, leads, appointments, photos, estimates, jobs, profiles, prices, activityLogs, accessCredentials, inspections, copilotMessages, routes, routeStops, aerialScans] = await Promise.all([
      db.employee.findMany(),
      db.lead.findMany(),
      db.appointment.findMany(),
      db.photoAsset.findMany(),
      db.estimate.findMany(),
      db.job.findMany(),
      db.pricingProfile.findMany(),
      db.supplierPrice.findMany(),
      db.activityLog.findMany(),
      db.accessCredential.findMany(),
      db.inspectionReport.findMany(),
      db.copilotMessage.findMany(),
      db.canvassRoute.findMany(),
      db.canvassStop.findMany(),
      db.aerialScan.findMany(),
    ])

    const exportedAt = new Date().toISOString()
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `true_north_fieldos_backup_${ts}.json`

    const body = {
      version: 2,
      exportedAt,
      employees,
      accessCredentials,
      leads,
      appointments,
      photos,
      estimates,
      jobs,
      profiles,
      prices,
      activityLogs,
      inspections,
      copilotMessages,
      routes,
      routeStops,
      aerialScans,
    }

    return new NextResponse(JSON.stringify(body, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('GET /api/backup failed', err)
    return NextResponse.json({ error: 'Failed to export backup' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdmin())) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })

    const body = await req.json()
    const {
      employees = [],
      accessCredentials = [],
      leads = [],
      appointments = [],
      photos = [],
      estimates = [],
      jobs = [],
      profiles = [],
      prices = [],
      activityLogs = [],
      inspections = [],
      copilotMessages = [],
      routes = [],
      routeStops = [],
      aerialScans = [],
    } = body || {}

    const counts = {
      employees: 0,
      accessCredentials: 0,
      leads: 0,
      appointments: 0,
      photos: 0,
      estimates: 0,
      jobs: 0,
      profiles: 0,
      prices: 0,
      activityLogs: 0,
      inspections: 0,
      copilotMessages: 0,
      routes: 0,
      routeStops: 0,
      aerialScans: 0,
    }

    for (const employee of Array.isArray(employees) ? employees : []) {
      if (!employee?.id || !employee?.name || !employee?.role) continue
      await db.employee.upsert({
        where: { id: String(employee.id) },
        create: {
          id: String(employee.id),
          name: String(employee.name),
          role: String(employee.role),
          email: String(employee.email ?? ''),
          phone: String(employee.phone ?? ''),
          notes: String(employee.notes ?? ''),
          active: employee.active !== false,
          lastLoginAt: employee.lastLoginAt ? new Date(employee.lastLoginAt) : null,
          createdAt: employee.createdAt ? new Date(employee.createdAt) : undefined,
          updatedAt: employee.updatedAt ? new Date(employee.updatedAt) : undefined,
        },
        update: {
          name: String(employee.name),
          role: String(employee.role),
          email: String(employee.email ?? ''),
          phone: String(employee.phone ?? ''),
          notes: String(employee.notes ?? ''),
          active: employee.active !== false,
          lastLoginAt: employee.lastLoginAt ? new Date(employee.lastLoginAt) : null,
        },
      })
      counts.employees++
    }

    for (const access of Array.isArray(accessCredentials) ? accessCredentials : []) {
      if (!access?.role || !access?.passwordHash) continue
      await db.accessCredential.upsert({
        where: { role: String(access.role) },
        create: {
          id: String(access.id || crypto.randomUUID()),
          role: String(access.role),
          passwordHash: String(access.passwordHash),
          createdAt: access.createdAt ? new Date(access.createdAt) : undefined,
          updatedAt: access.updatedAt ? new Date(access.updatedAt) : undefined,
        },
        update: { passwordHash: String(access.passwordHash) },
      })
      counts.accessCredentials++
    }

    for (const lead of Array.isArray(leads) ? leads : []) {
      if (!lead?.id || !lead?.street) continue
      await db.lead.upsert({
        where: { id: String(lead.id) },
        create: {
          id: String(lead.id),
          name: String(lead.name ?? ''),
          phone: String(lead.phone ?? ''),
          email: String(lead.email ?? ''),
          street: String(lead.street),
          city: String(lead.city ?? 'Mount Vernon'),
          state: String(lead.state ?? 'OH'),
          zip: String(lead.zip ?? ''),
          source: String(lead.source ?? 'door_knock'),
          territory: String(lead.territory ?? 'Knox County'),
          notes: String(lead.notes ?? ''),
          stage: String(lead.stage ?? 'new'),
          nextAction: String(lead.nextAction ?? 'Initial contact and inspection scheduling'),
          verifiedArea: lead.verifiedArea != null ? Number(lead.verifiedArea) : null,
          pitch: lead.pitch != null ? Number(lead.pitch) : null,
          contractFile: lead.contractFile ? String(lead.contractFile) : null,
          createdById: lead.createdById ? String(lead.createdById) : null,
          createdAt: lead.createdAt ? new Date(lead.createdAt) : undefined,
          updatedAt: lead.updatedAt ? new Date(lead.updatedAt) : undefined,
        },
        update: {
          name: String(lead.name ?? ''),
          phone: String(lead.phone ?? ''),
          email: String(lead.email ?? ''),
          street: String(lead.street),
          city: String(lead.city ?? 'Mount Vernon'),
          state: String(lead.state ?? 'OH'),
          zip: String(lead.zip ?? ''),
          source: String(lead.source ?? 'door_knock'),
          territory: String(lead.territory ?? 'Knox County'),
          notes: String(lead.notes ?? ''),
          stage: String(lead.stage ?? 'new'),
          nextAction: String(lead.nextAction ?? 'Initial contact and inspection scheduling'),
          verifiedArea: lead.verifiedArea != null ? Number(lead.verifiedArea) : null,
          pitch: lead.pitch != null ? Number(lead.pitch) : null,
          contractFile: lead.contractFile ? String(lead.contractFile) : null,
          createdById: lead.createdById ? String(lead.createdById) : null,
        },
      })
      counts.leads++
    }

    for (const appointment of Array.isArray(appointments) ? appointments : []) {
      if (!appointment?.id || !appointment?.leadId) continue
      await db.appointment.upsert({
        where: { id: String(appointment.id) },
        create: {
          id: String(appointment.id),
          leadId: String(appointment.leadId),
          address: String(appointment.address ?? ''),
          status: String(appointment.status ?? 'no'),
          appointmentDate: appointment.appointmentDate ? new Date(appointment.appointmentDate) : null,
          notes: String(appointment.notes ?? ''),
          createdById: appointment.createdById ? String(appointment.createdById) : null,
          createdAt: appointment.createdAt ? new Date(appointment.createdAt) : undefined,
          updatedAt: appointment.updatedAt ? new Date(appointment.updatedAt) : undefined,
        },
        update: {
          leadId: String(appointment.leadId),
          address: String(appointment.address ?? ''),
          status: String(appointment.status ?? 'no'),
          appointmentDate: appointment.appointmentDate ? new Date(appointment.appointmentDate) : null,
          notes: String(appointment.notes ?? ''),
          createdById: appointment.createdById ? String(appointment.createdById) : null,
        },
      })
      counts.appointments++
    }

    for (const photo of Array.isArray(photos) ? photos : []) {
      if (!photo?.id || !photo?.dataUrl) continue
      await db.photoAsset.upsert({
        where: { id: String(photo.id) },
        create: {
          id: String(photo.id),
          leadId: photo.leadId ? String(photo.leadId) : null,
          address: String(photo.address ?? ''),
          title: String(photo.title ?? 'Roof photo'),
          category: String(photo.category ?? 'roof'),
          dataUrl: String(photo.dataUrl),
          createdById: photo.createdById ? String(photo.createdById) : null,
          createdAt: photo.createdAt ? new Date(photo.createdAt) : undefined,
          updatedAt: photo.updatedAt ? new Date(photo.updatedAt) : undefined,
        },
        update: {
          leadId: photo.leadId ? String(photo.leadId) : null,
          address: String(photo.address ?? ''),
          title: String(photo.title ?? 'Roof photo'),
          category: String(photo.category ?? 'roof'),
          dataUrl: String(photo.dataUrl),
          createdById: photo.createdById ? String(photo.createdById) : null,
        },
      })
      counts.photos++
    }

    for (const estimate of Array.isArray(estimates) ? estimates : []) {
      if (!estimate?.id) continue
      await db.estimate.upsert({
        where: { id: String(estimate.id) },
        create: {
          id: String(estimate.id),
          leadId: estimate.leadId ? String(estimate.leadId) : null,
          property: String(estimate.property ?? ''),
          product: String(estimate.product ?? ''),
          productId: String(estimate.productId ?? ''),
          color: String(estimate.color ?? ''),
          area: Number(estimate.area ?? 0),
          squares: Number(estimate.squares ?? 0),
          wastePct: Number(estimate.wastePct ?? 12),
          discount: Number(estimate.discount ?? 0),
          shinglePerSq: Number(estimate.shinglePerSq ?? 0),
          profileName: String(estimate.profileName ?? ''),
          price: Number(estimate.price ?? 0),
          directCost: Number(estimate.directCost ?? 0),
          grossProfit: Number(estimate.grossProfit ?? 0),
          grossMarginPct: Number(estimate.grossMarginPct ?? 0),
          status: String(estimate.status ?? 'sent'),
          createdById: estimate.createdById ? String(estimate.createdById) : null,
          createdAt: estimate.createdAt ? new Date(estimate.createdAt) : undefined,
          updatedAt: estimate.updatedAt ? new Date(estimate.updatedAt) : undefined,
        },
        update: {
          leadId: estimate.leadId ? String(estimate.leadId) : null,
          property: String(estimate.property ?? ''),
          product: String(estimate.product ?? ''),
          productId: String(estimate.productId ?? ''),
          color: String(estimate.color ?? ''),
          area: Number(estimate.area ?? 0),
          squares: Number(estimate.squares ?? 0),
          wastePct: Number(estimate.wastePct ?? 12),
          discount: Number(estimate.discount ?? 0),
          shinglePerSq: Number(estimate.shinglePerSq ?? 0),
          profileName: String(estimate.profileName ?? ''),
          price: Number(estimate.price ?? 0),
          directCost: Number(estimate.directCost ?? 0),
          grossProfit: Number(estimate.grossProfit ?? 0),
          grossMarginPct: Number(estimate.grossMarginPct ?? 0),
          status: String(estimate.status ?? 'sent'),
          createdById: estimate.createdById ? String(estimate.createdById) : null,
        },
      })
      counts.estimates++
    }

    for (const job of Array.isArray(jobs) ? jobs : []) {
      if (!job?.id) continue
      await db.job.upsert({
        where: { id: String(job.id) },
        create: {
          id: String(job.id),
          estimateId: job.estimateId ? String(job.estimateId) : null,
          leadId: job.leadId ? String(job.leadId) : null,
          property: String(job.property ?? ''),
          contractValue: Number(job.contractValue ?? 0),
          actualCost: Number(job.actualCost ?? 0),
          cashCollected: Number(job.cashCollected ?? 0),
          balance: Number(job.balance ?? 0),
          contractFilename: job.contractFilename ? String(job.contractFilename) : null,
          status: String(job.status ?? 'scheduled'),
          startDate: job.startDate ? new Date(job.startDate) : null,
          completedAt: job.completedAt ? new Date(job.completedAt) : null,
          createdById: job.createdById ? String(job.createdById) : null,
          createdAt: job.createdAt ? new Date(job.createdAt) : undefined,
          updatedAt: job.updatedAt ? new Date(job.updatedAt) : undefined,
        },
        update: {
          estimateId: job.estimateId ? String(job.estimateId) : null,
          leadId: job.leadId ? String(job.leadId) : null,
          property: String(job.property ?? ''),
          contractValue: Number(job.contractValue ?? 0),
          actualCost: Number(job.actualCost ?? 0),
          cashCollected: Number(job.cashCollected ?? 0),
          balance: Number(job.balance ?? 0),
          contractFilename: job.contractFilename ? String(job.contractFilename) : null,
          status: String(job.status ?? 'scheduled'),
          startDate: job.startDate ? new Date(job.startDate) : null,
          completedAt: job.completedAt ? new Date(job.completedAt) : null,
          createdById: job.createdById ? String(job.createdById) : null,
        },
      })
      counts.jobs++
    }

    for (const profile of Array.isArray(profiles) ? profiles : []) {
      if (!profile?.id) continue
      await db.pricingProfile.upsert({
        where: { id: String(profile.id) },
        create: {
          id: String(profile.id),
          name: String(profile.name ?? ''),
          materialPerSq: Number(profile.materialPerSq ?? 0),
          laborPerSq: Number(profile.laborPerSq ?? 0),
          tearOffPerSq: Number(profile.tearOffPerSq ?? 0),
          underlaymentPerSq: Number(profile.underlaymentPerSq ?? 0),
          accessoriesPerSq: Number(profile.accessoriesPerSq ?? 0),
          disposalPerJob: Number(profile.disposalPerJob ?? 0),
          permitPerJob: Number(profile.permitPerJob ?? 0),
          salesCommissionPct: Number(profile.salesCommissionPct ?? 10),
          targetGrossMarginPct: Number(profile.targetGrossMarginPct ?? 35),
          isDefault: Boolean(profile.isDefault),
          createdAt: profile.createdAt ? new Date(profile.createdAt) : undefined,
          updatedAt: profile.updatedAt ? new Date(profile.updatedAt) : undefined,
        },
        update: {
          name: String(profile.name ?? ''),
          materialPerSq: Number(profile.materialPerSq ?? 0),
          laborPerSq: Number(profile.laborPerSq ?? 0),
          tearOffPerSq: Number(profile.tearOffPerSq ?? 0),
          underlaymentPerSq: Number(profile.underlaymentPerSq ?? 0),
          accessoriesPerSq: Number(profile.accessoriesPerSq ?? 0),
          disposalPerJob: Number(profile.disposalPerJob ?? 0),
          permitPerJob: Number(profile.permitPerJob ?? 0),
          salesCommissionPct: Number(profile.salesCommissionPct ?? 10),
          targetGrossMarginPct: Number(profile.targetGrossMarginPct ?? 35),
          isDefault: Boolean(profile.isDefault),
        },
      })
      counts.profiles++
    }

    for (const price of Array.isArray(prices) ? prices : []) {
      if (!price?.id) continue
      await db.supplierPrice.upsert({
        where: { id: String(price.id) },
        create: {
          id: String(price.id),
          product: String(price.product ?? ''),
          color: String(price.color ?? ''),
          price: Number(price.price ?? 0),
          supplier: String(price.supplier ?? ''),
          item: String(price.item ?? ''),
          savedAt: price.savedAt ? new Date(price.savedAt) : new Date(),
        },
        update: {
          product: String(price.product ?? ''),
          color: String(price.color ?? ''),
          price: Number(price.price ?? 0),
          supplier: String(price.supplier ?? ''),
          item: String(price.item ?? ''),
          savedAt: price.savedAt ? new Date(price.savedAt) : new Date(),
        },
      })
      counts.prices++
    }

    for (const inspection of Array.isArray(inspections) ? inspections : []) {
      if (!inspection?.id || !inspection?.photoDataUrl) continue
      await db.inspectionReport.upsert({
        where: { id: String(inspection.id) },
        create: {
          id: String(inspection.id),
          leadId: inspection.leadId ? String(inspection.leadId) : null,
          photoDataUrl: String(inspection.photoDataUrl),
          windCount: Number(inspection.windCount ?? 0),
          hailCount: Number(inspection.hailCount ?? 0),
          missingCount: Number(inspection.missingCount ?? 0),
          totalCount: Number(inspection.totalCount ?? 0),
          recommendedIko: String(inspection.recommendedIko ?? ''),
          summary: String(inspection.summary ?? ''),
          source: String(inspection.source ?? 'AI Vision (VLM)'),
          createdAt: inspection.createdAt ? new Date(inspection.createdAt) : undefined,
        },
        update: {
          leadId: inspection.leadId ? String(inspection.leadId) : null,
          photoDataUrl: String(inspection.photoDataUrl),
          windCount: Number(inspection.windCount ?? 0),
          hailCount: Number(inspection.hailCount ?? 0),
          missingCount: Number(inspection.missingCount ?? 0),
          totalCount: Number(inspection.totalCount ?? 0),
          recommendedIko: String(inspection.recommendedIko ?? ''),
          summary: String(inspection.summary ?? ''),
          source: String(inspection.source ?? 'AI Vision (VLM)'),
        },
      })
      counts.inspections++
    }

    for (const message of Array.isArray(copilotMessages) ? copilotMessages : []) {
      if (!message?.id || !message?.role) continue
      await db.copilotMessage.upsert({
        where: { id: String(message.id) },
        create: {
          id: String(message.id),
          role: String(message.role),
          content: String(message.content ?? ''),
          createdAt: message.createdAt ? new Date(message.createdAt) : undefined,
        },
        update: {
          role: String(message.role),
          content: String(message.content ?? ''),
        },
      })
      counts.copilotMessages++
    }

    for (const route of Array.isArray(routes) ? routes : []) {
      if (!route?.id || !route?.name) continue
      await db.canvassRoute.upsert({
        where: { id: String(route.id) },
        create: {
          id: String(route.id),
          name: String(route.name),
          town: String(route.town ?? ''),
          status: String(route.status ?? 'draft'),
          notes: String(route.notes ?? ''),
          completedAt: route.completedAt ? new Date(route.completedAt) : null,
          createdAt: route.createdAt ? new Date(route.createdAt) : undefined,
          updatedAt: route.updatedAt ? new Date(route.updatedAt) : undefined,
        },
        update: {
          name: String(route.name),
          town: String(route.town ?? ''),
          status: String(route.status ?? 'draft'),
          notes: String(route.notes ?? ''),
          completedAt: route.completedAt ? new Date(route.completedAt) : null,
        },
      })
      counts.routes++
    }

    for (const stop of Array.isArray(routeStops) ? routeStops : []) {
      if (!stop?.id || !stop?.routeId || !stop?.street) continue
      await db.canvassStop.upsert({
        where: { id: String(stop.id) },
        create: {
          id: String(stop.id),
          routeId: String(stop.routeId),
          leadId: stop.leadId ? String(stop.leadId) : null,
          street: String(stop.street),
          name: String(stop.name ?? ''),
          lat: Number(stop.lat ?? 0),
          lng: Number(stop.lng ?? 0),
          order: Number(stop.order ?? 0),
          status: String(stop.status ?? 'pending'),
          notes: String(stop.notes ?? ''),
          visitedAt: stop.visitedAt ? new Date(stop.visitedAt) : null,
          createdAt: stop.createdAt ? new Date(stop.createdAt) : undefined,
        },
        update: {
          routeId: String(stop.routeId),
          leadId: stop.leadId ? String(stop.leadId) : null,
          street: String(stop.street),
          name: String(stop.name ?? ''),
          lat: Number(stop.lat ?? 0),
          lng: Number(stop.lng ?? 0),
          order: Number(stop.order ?? 0),
          status: String(stop.status ?? 'pending'),
          notes: String(stop.notes ?? ''),
          visitedAt: stop.visitedAt ? new Date(stop.visitedAt) : null,
        },
      })
      counts.routeStops++
    }

    for (const scan of Array.isArray(aerialScans) ? aerialScans : []) {
      if (!scan?.id || !scan?.address) continue
      await db.aerialScan.upsert({
        where: { id: String(scan.id) },
        create: {
          id: String(scan.id),
          leadId: scan.leadId ? String(scan.leadId) : null,
          lat: Number(scan.lat ?? 0),
          lng: Number(scan.lng ?? 0),
          address: String(scan.address),
          conditionScore: Number(scan.conditionScore ?? 0),
          condition: String(scan.condition ?? 'unknown'),
          findings: String(scan.findings ?? ''),
          indicators: String(scan.indicators ?? '[]'),
          imageDataUrl: String(scan.imageDataUrl ?? ''),
          scannedAt: scan.scannedAt ? new Date(scan.scannedAt) : undefined,
        },
        update: {
          leadId: scan.leadId ? String(scan.leadId) : null,
          lat: Number(scan.lat ?? 0),
          lng: Number(scan.lng ?? 0),
          address: String(scan.address),
          conditionScore: Number(scan.conditionScore ?? 0),
          condition: String(scan.condition ?? 'unknown'),
          findings: String(scan.findings ?? ''),
          indicators: String(scan.indicators ?? '[]'),
          imageDataUrl: String(scan.imageDataUrl ?? ''),
          scannedAt: scan.scannedAt ? new Date(scan.scannedAt) : new Date(),
        },
      })
      counts.aerialScans++
    }

    for (const log of Array.isArray(activityLogs) ? activityLogs : []) {
      if (!log?.id || !log?.employeeId) continue
      await db.activityLog.upsert({
        where: { id: String(log.id) },
        create: {
          id: String(log.id),
          employeeId: String(log.employeeId),
          action: String(log.action ?? 'restored'),
          entityType: String(log.entityType ?? 'backup'),
          entityId: log.entityId ? String(log.entityId) : null,
          summary: String(log.summary ?? 'Restored from backup'),
          createdAt: log.createdAt ? new Date(log.createdAt) : undefined,
        },
        update: {
          employeeId: String(log.employeeId),
          action: String(log.action ?? 'restored'),
          entityType: String(log.entityType ?? 'backup'),
          entityId: log.entityId ? String(log.entityId) : null,
          summary: String(log.summary ?? 'Restored from backup'),
        },
      })
      counts.activityLogs++
    }

    return NextResponse.json({ ok: true, counts })
  } catch (err) {
    console.error('POST /api/backup failed', err)
    return NextResponse.json({ error: 'Failed to restore backup. Verify that the backup came from a compatible Field OS version.' }, { status: 500 })
  }
}
