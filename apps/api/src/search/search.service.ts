import { Inject, Injectable } from "@nestjs/common";
import type { DatabaseClient } from "@crmkaro/database";
import { withTenant } from "@crmkaro/database";
import { DATABASE } from "../database/database.module.js";

export type SearchResultItem = {
  id: string;
  type: "person" | "lead" | "invoice" | "product";
  title: string;
  subtitle: string;
  badge?: string;
  url: string;
};

@Injectable()
export class SearchService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  async search(
    organisationId: string,
    userId: string,
    query: string,
  ): Promise<{ results: SearchResultItem[] }> {
    const q = query.trim();
    if (!q || q.length < 1) {
      return { results: [] };
    }

    return withTenant(this.database, organisationId, userId, async (tx) => {
      const enabledServices = await tx.organisationService.findMany({
        where: { organisationId, status: { in: ["ACTIVE", "TRIAL"] } },
        include: { service: true },
      });
      const services = new Set(
        enabledServices.map((item) => item.service.code),
      );

      const results: SearchResultItem[] = [];

      // 1. Search People
      if (services.has("people")) {
        const people = await tx.person.findMany({
          where: {
            organisationId,
            status: "ACTIVE",
            OR: [
              { displayName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { primaryPhone: { contains: q } },
            ],
          },
          take: 5,
          include: { types: true },
        });

        for (const person of people) {
          const typeNames = person.types.map((t) => t.type).join(", ");
          results.push({
            id: person.id,
            type: "person",
            title: person.displayName,
            subtitle: person.email || person.primaryPhone || "No contact info",
            badge: typeNames || "Person",
            url: `/people?id=${person.id}`,
          });
        }
      }

      // 2. Search Leads
      if (services.has("crm")) {
        const leads = await tx.lead.findMany({
          where: {
            organisationId,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              { source: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 5,
          include: { stage: true },
        });

        for (const lead of leads) {
          results.push({
            id: lead.id,
            type: "lead",
            title: lead.name,
            subtitle: lead.email || lead.phone || lead.source || "Open Lead",
            badge: lead.stage?.name || lead.status,
            url: `/crm?leadId=${lead.id}`,
          });
        }
      }

      // 3. Search Invoices
      if (services.has("finance")) {
        const invoices = await tx.invoice.findMany({
          where: {
            organisationId,
            OR: [
              { invoiceNumber: { contains: q, mode: "insensitive" } },
              { person: { displayName: { contains: q, mode: "insensitive" } } },
            ],
          },
          take: 5,
          include: { person: { select: { displayName: true } } },
        });

        for (const invoice of invoices) {
          results.push({
            id: invoice.id,
            type: "invoice",
            title: invoice.invoiceNumber,
            subtitle: invoice.person?.displayName || "Invoice",
            badge: invoice.status,
            url: `/finance?invoiceId=${invoice.id}`,
          });
        }
      }

      // 4. Search Products
      if (services.has("inventory")) {
        const products = await tx.product.findMany({
          where: {
            organisationId,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 5,
          include: { category: true },
        });

        for (const product of products) {
          results.push({
            id: product.id,
            type: "product",
            title: product.name,
            subtitle: `SKU: ${product.sku} · Stock: ${product.currentStock}`,
            badge: product.category?.name || "Product",
            url: `/inventory?productId=${product.id}`,
          });
        }
      }

      return { results };
    });
  }
}
