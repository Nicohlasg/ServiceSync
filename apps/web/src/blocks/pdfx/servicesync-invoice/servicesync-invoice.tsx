import { PdfxThemeProvider, usePdfxTheme } from '../../../lib/pdfx-theme-context';
import { KeyValue } from '../../../components/pdfx/key-value/pdfx-key-value';
import { PageFooter } from '../../../components/pdfx/page-footer/pdfx-page-footer';
import { PageHeader } from '../../../components/pdfx/page-header/pdfx-page-header';
import { Section } from '../../../components/pdfx/section/pdfx-section';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '../../../components/pdfx/table/pdfx-table';
import { Text } from '../../../components/pdfx/text/pdfx-text';
import type { PdfxTheme } from '../../../lib/pdfx-theme';
import { Document, Page, StyleSheet, View } from '@react-pdf/renderer';
import type { ServiceSyncInvoiceData } from './servicesync-invoice.types';

export function ServiceSyncInvoiceDocument({
  theme,
  data,
}: {
  theme?: PdfxTheme;
  data: ServiceSyncInvoiceData;
}) {
  return (
    <PdfxThemeProvider theme={theme}>
      <ServiceSyncInvoiceContent data={data} />
    </PdfxThemeProvider>
  );
}

function fmtCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusLabel(status: ServiceSyncInvoiceData['status']): string {
  switch (status) {
    case 'paid_cash':
    case 'paid_qr':
      return 'PAID';
    case 'void':
      return 'VOID';
    case 'disputed':
      return 'DISPUTED';
    case 'awaiting_qr_confirmation':
      return 'AWAITING CONFIRMATION';
    case 'pending':
      return 'PENDING';
    default:
      return 'DRAFT';
  }
}

function ServiceSyncInvoiceContent({ data }: { data: ServiceSyncInvoiceData }) {
  const theme = usePdfxTheme();

  const isPaid = data.status === 'paid_cash' || data.status === 'paid_qr';
  const isVoid = data.status === 'void';

  const styles = StyleSheet.create({
    page: {
      padding: theme.spacing.page.marginTop,
      paddingBottom: theme.spacing.page.marginBottom,
      backgroundColor: theme.colors.background,
    },
    statusBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      marginBottom: 12,
      backgroundColor: isPaid
        ? theme.colors.success ?? '#16a34a'
        : isVoid
          ? theme.colors.destructive
          : theme.colors.primary,
    },
    statusText: {
      fontSize: 8,
      fontWeight: 'bold',
      color: theme.colors.primaryForeground,
      letterSpacing: 1,
    },
    metaRow: {
      flexDirection: 'row',
      marginBottom: theme.spacing.sectionGap,
    },
    metaCol: {
      flex: 1,
      paddingRight: 12,
    },
    metaLabel: {
      fontSize: 8,
      fontWeight: 'bold',
      color: theme.colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 3,
    },
    metaValue: {
      fontSize: 9,
      color: theme.colors.foreground,
    },
    dividerCol: {
      width: 1,
      backgroundColor: theme.colors.border,
      marginRight: 12,
    },
  });

  const acraLine = data.company.uen
    ? `UEN: ${data.company.uen}${data.company.acraVerified ? ' ✓ ACRA Verified' : ''}`
    : undefined;

  return (
    <Document title={`Invoice ${data.invoiceNumber}`}>
      <Page size="A4" style={styles.page}>
        <PageHeader
          variant="simple"
          title={data.company.name}
          subtitle={[data.company.phone, acraLine].filter(Boolean).join('  ·  ')}
          rightText={`INVOICE ${data.invoiceNumber}`}
          rightSubText={data.dueDate ? `Due: ${data.dueDate}` : `Issued: ${data.invoiceDate}`}
        />

        {/* Status badge */}
        <View style={styles.statusBadge}>
          <Text style={styles.statusText} noMargin>
            {statusLabel(data.status)}
          </Text>
        </View>

        {/* Meta row: dates + client */}
        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel} noMargin>Invoice Date</Text>
            <Text style={styles.metaValue} noMargin>{data.invoiceDate}</Text>
          </View>
          {data.dueDate && (
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel} noMargin>Due Date</Text>
              <Text style={styles.metaValue} noMargin>{data.dueDate}</Text>
            </View>
          )}
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel} noMargin>Service</Text>
            <Text style={styles.metaValue} noMargin>{data.service.type}</Text>
            <Text style={{ ...styles.metaValue, color: theme.colors.mutedForeground }} noMargin>
              {data.service.date}
            </Text>
          </View>
          <View style={styles.dividerCol} />
          <View style={{ flex: 2 }}>
            <Text style={styles.metaLabel} noMargin>Billed To</Text>
            <Text style={{ ...styles.metaValue, fontWeight: 'bold' }} noMargin>
              {data.client.name}
            </Text>
            {data.client.phone && (
              <Text style={{ ...styles.metaValue, color: theme.colors.mutedForeground }} noMargin>
                {data.client.phone}
              </Text>
            )}
            {data.client.address && (
              <Text style={{ ...styles.metaValue, color: theme.colors.mutedForeground }} noMargin>
                {data.client.address}
              </Text>
            )}
          </View>
        </View>

        {/* Line items table */}
        <Table variant="primary-header">
          <TableHeader>
            <TableRow header>
              <TableCell>Description</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((item, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: invoice items have no stable id
              <TableRow key={index}>
                <TableCell>{item.description}</TableCell>
                <TableCell align="right">{fmtCents(item.amountCents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Summary + payment */}
        <Section noWrap style={{ flexDirection: 'row', marginTop: 16 }}>
          <View style={{ flex: 1, paddingRight: 20 }}>
            <Text style={styles.metaLabel} noMargin>Payment</Text>
            <Text variant="xs" noMargin>{data.payment.methodLabel}</Text>
            {data.payment.paidAt && (
              <Text variant="xs" noMargin color="mutedForeground">
                {`Paid on ${data.payment.paidAt}`}
              </Text>
            )}
            {data.summary.depositAmountCents > 0 && (
              <Text variant="xs" noMargin color="mutedForeground">
                {`Deposit paid: ${fmtCents(data.summary.depositAmountCents)}`}
              </Text>
            )}
          </View>
          <View style={{ width: 220 }}>
            <KeyValue
              size="sm"
              dividerThickness={1}
              items={[
                ...(data.summary.taxCents > 0
                  ? [
                      { key: 'Subtotal', value: fmtCents(data.summary.subtotalCents) },
                      { key: 'GST (9%)', value: fmtCents(data.summary.taxCents) },
                    ]
                  : []),
                {
                  key: 'Total',
                  value: fmtCents(data.summary.totalCents),
                  valueStyle: { fontSize: 12, fontWeight: 'bold' },
                  keyStyle: { fontSize: 12, fontWeight: 'bold' },
                },
                ...(data.summary.balanceDueCents !== data.summary.totalCents
                  ? [
                      {
                        key: 'Balance Due',
                        value: fmtCents(data.summary.balanceDueCents),
                        valueStyle: { fontSize: 11, fontWeight: 'bold' },
                        keyStyle: { fontSize: 11, fontWeight: 'bold' },
                      },
                    ]
                  : []),
              ]}
              divided
            />
          </View>
        </Section>

        <PageFooter
          leftText={data.notes ?? data.footerNote}
          rightText="Page 1 of 1"
          sticky
          pagePadding={25}
        />
      </Page>
    </Document>
  );
}
