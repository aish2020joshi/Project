import { useEffect, useState } from 'react';
import {
  Container,
  Button,
  Tabs,
  Card,
  TextInput,
  Grid,
  Table,
  Stack,
  Group,
  Text,
  Alert,
  FileInput,
  Select,
  Image
} from '@mantine/core';

const TAB_OPTIONS = [
  { key: 'General', label: { en: 'General', hi: 'General' } },
  { key: 'SakriyaSadasya', label: { en: 'Sakriya Sadasya', hi: 'सक्रिय सदस्य' } },
  { key: 'Sankarashyaksadashya', label: { en: 'SANKARASHYAK SADASYA', hi: 'संरक्षक सदस्य' } }
];

const FIELDS = [
  { key: 'क्रम संख्या', label: { en: 'Serial No', hi: 'क्रम संख्या' } },
  { key: 'सदस्यता क्रमांक', label: { en: 'Membership No', hi: 'सदस्यता क्रमांक' } },
  { key: 'नाम', label: { en: 'Name', hi: 'नाम' } },
  { key: 'मोबाईल', label: { en: 'Mobile', hi: 'मोबाईल' } },
  { key: 'पता', label: { en: 'Address', hi: 'पता' } },
  { key: 'जन्म दिनांक', label: { en: 'Date of Birth', hi: 'जन्म दिनांक' } },
  { key: 'जन्म तिथि', label: { en: 'Birth Date', hi: 'जन्म तिथि' } },
  { key: 'विवाह की दिनांक', label: { en: 'Marriage Date', hi: 'विवाह की दिनांक' } },
  { key: 'विवाह की तिथि', label: { en: 'Marriage Date', hi: 'विवाह की तिथि' } },
  { key: 'शुल्क प्राप्ति तिथि', label: { en: 'Date of Fee Receipt', hi: 'शुल्क प्राप्ति की तिथि' } }
];

const defaultForm = FIELDS.reduce((acc, field) => ({ ...acc, [field.key]: '' }), {});

function App() {
  const [activeTab, setActiveTab] = useState('General');
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(defaultForm);
  const [message, setMessage] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [editIndex, setEditIndex] = useState(null);
  const [editData, setEditData] = useState({});
  const [selectedRows, setSelectedRows] = useState({});

  function getTabLabel(tabKey) {
    return TAB_OPTIONS.find((tab) => tab.key === tabKey) || TAB_OPTIONS[0];
  }

  useEffect(() => {
    loadItems(activeTab);
    setSelectedRows({});
  }, [activeTab]);

  useEffect(() => {
    handleFilter();
    setSelectedRows({});
  }, [search, items]);

  function handleFilter() {
    const filtered = items.filter((item) =>
      Object.values(item).some((val) =>
        String(val).toLowerCase().includes(search.toLowerCase())
      )
    );
    setFilteredItems(filtered);
    setPage(1);
  }

  async function loadItems(category) {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/items?category=${category}`);
      const data = await response.json();
      const finalData = Array.isArray(data) ? data : data.items || [];
      setItems(finalData);
      setFilteredItems(finalData);
    } catch {
      setMessage('डेटा लोड करने में त्रुटि।(Sorry, something went wrong)');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleImport() {
    if (!importFile) {
      setMessage('कृपया एक फाइल चुनें।(Select the file)');
      return;
    }

    const form = new FormData();
    form.append('file', importFile);
    form.append('category', activeTab);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: form
      });
      const data = await response.json();

      if (response.ok) {
        setMessage(`फाइल अपलोड हुई। ${data.added} प्रविष्टियाँ जोड़ीं।`);
        setImportFile(null);
        loadItems(activeTab);
      } else {
        setMessage(data.error || 'अपलोड विफल रहा। (Fail To Upload)');
      }
    } catch {
      setMessage('अपलोड में त्रुटि हुई।');
    }
  }

  async function handleAddItem(e) {
    e.preventDefault();
    try {
      const response = await fetch('/api/item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: activeTab, item: formData })
      });
      const data = await response.json();

      if (response.ok) {
        setMessage('नया सदस्य जोड़ा गया। ');
        setFormData(defaultForm);
        setShowForm(false);
        loadItems(activeTab);
      } else {
        setMessage(data.error || 'त्रुटि।');
      }
    } catch {
      setMessage('सर्वर त्रुटि।');
    }
  }

  async function handleSave(index) {
    const updatedItems = [...items];
    updatedItems[index] = editData;
    setItems(updatedItems);
    setEditIndex(null);
    await fetch('/api/item/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: activeTab, index, item: editData })
    });
  }

  async function handleDeleteItem(index) {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      const response = await fetch('/api/item/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: activeTab, index })
      });
      const data = await response.json();
      if (response.ok) {
        setMessage('सदस्य सफलतापूर्वक हटा दिया गया।');
        loadItems(activeTab); // Reload to refresh state
      } else {
        setMessage(data.error || 'Deletion failed.');
      }
    } catch {
      setMessage('Deletion failed.');
    }
  }

  function handleToggleSelect(index) {
    setSelectedRows((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  function printRecords(records, title) {
    const printRows = records.map((item) =>
      `<tr>${FIELDS.map((field) => `<td>${String(item[field.key] || '')}</td>`).join('')}</tr>`
    ).join('');

    const printHtml = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { margin: 16px; font-family: sans-serif; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #333; padding: 6px; text-align: left; }
            th { background: #f0f0f0; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <table>
            <thead>
              <tr>${FIELDS.map((field) => `<th>${field.label.en}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${printRows}
            </tbody>
          </table>
        </body>
      </html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } else {
      setMessage('Unable to open print window.');
    }
  }

  function handlePrintSelected() {
    const selected = items.filter((_, index) => selectedRows[index]);
    if (selected.length === 0) {
      setMessage('कृपया प्रिंट करने के लिए कम से कम एक रिकॉर्ड चुनें।');
      return;
    }
    printRecords(selected, 'Selected Records');
  }

  function handlePrintAll() {
    const allItems = filteredItems.length > 0 ? filteredItems : items;
    if (allItems.length === 0) {
      setMessage('प्रिंट करने के लिए कोई रिकॉर्ड मौजूद नहीं है।');
      return;
    }
    printRecords(allItems, 'All Records');
  }

  const start = (page - 1) * rowsPerPage;
  const paginatedData = filteredItems.slice(start, start + rowsPerPage);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
  const currentTab = getTabLabel(activeTab);

  return (
    <Container fluid p={0} style={{ minHeight: '100vh' }}>
      <Stack gap="lg">

        <Card withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>

          {/* Top small line */}
          <Text ta="center" size="xs" mt={4}>
            ॥ जय श्री राम ॥
          </Text>

          {/* Main Header */}
          <Group align="center" p="md" wrap="nowrap">

            <div style={{ width: 110, display: 'flex', justifyContent: 'center' }}>
              <Image
                src="/logo.jpeg"
                alt="logo"
                width={90}
                height={90}
                fit="contain"
              />
            </div>

            {/* Center Content */}
            <Stack
              gap={2}
              style={{
                flex: 1,
                textAlign: 'center'
              }}
            >
              <Text fw={700} size="xl" c="red">
                श्री हनुमत शक्ति जागरण समिति, अजमेर (रजि.)
              </Text>

              <Text size="sm">
                प्रधान कार्यालय : 41, अभियंता नगर, वैशाली नगर, अजमेर-305004
              </Text>

              <Text size="xs" c="red">
                Email - shreehanumatshaktijagransamiti@gmail.com
              </Text>
            </Stack>

            {/* Right Spacer (IMPORTANT) */}
            <div style={{ width: 80 }} />

          </Group>


        </Card>

        <Tabs value={activeTab} onChange={setActiveTab}>

          <Tabs.List>
            {TAB_OPTIONS.map((tab) => (
              <Tabs.Tab key={tab.key} value={tab.key}>
                {tab.label.en} / {tab.label.hi}
              </Tabs.Tab>
            ))}
          </Tabs.List>

          {TAB_OPTIONS.map((tab) => (
            <Tabs.Panel key={tab.key} value={tab.key} pt="md">
              <Card withBorder mb="md">
                <Text fw={600} mb="md">
                  {tab.label.en} Details / {tab.label.hi} का विवरण
                </Text>

                <Group gap="sm" align="center" mb="md">

                  <Button onClick={() => setShowForm((v) => !v)}>
                    {showForm ? 'Hide / छुपाएँ' : 'Add / जोड़ें'}
                  </Button>

                  <FileInput
                    placeholder="Select File / फाइल चुनें"
                    value={importFile}
                    onChange={setImportFile}
                    clearable
                  />

                  <Button onClick={handleImport}>
                    Import / आयात
                  </Button>

                  <Button size="sm" onClick={handlePrintAll}>
                    Print All / सभी प्रिंट
                  </Button>

                  <Button size="sm" onClick={handlePrintSelected} disabled={Object.values(selectedRows).filter(Boolean).length === 0}>
                    Print Selected / चयनित प्रिंट
                  </Button>
                </Group>

                {showForm && (
                  <div style={{ marginTop: 16 }}>
                    <form onSubmit={handleAddItem}>
                      <Grid>
                        {FIELDS.map((field) => (
                          <Grid.Col key={field.key} span={4}>
                            <TextInput
                              label={`${field.label.en} / ${field.label.hi}`}
                              value={formData[field.key]}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  [field.key]: e.target.value
                                })
                              }
                            />
                          </Grid.Col>
                        ))}
                      </Grid>

                      <Button type="submit" mt="md" fullWidth>
                        Add / जोड़ें
                      </Button>
                    </form>
                  </div>
                )}

                <Group gap="md" align="center" mt="md">
                  <TextInput
                    placeholder="Search... / खोजें..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <Select
                    value={String(rowsPerPage)}
                    onChange={(val) => setRowsPerPage(Number(val))}
                    data={['10', '20', '50', '100']}
                    placeholder="Rows / पंक्तियाँ"
                  />
                  <Text size="sm" c="dimmed">
                    Selected: {Object.values(selectedRows).filter(Boolean).length}
                  </Text>
                </Group>

              </Card>

              <Card withBorder>
                <Text fw={600} mb="md">
                  {tab.label.en} List / {tab.label.hi} सूची
                </Text>

                {isLoading ? (
                  <Text>Loading / लोड हो रहा है...</Text>
                ) : paginatedData.length === 0 ? (
                  <Text>No data found / कोई डेटा नहीं मिला</Text>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <Table
                      striped
                      highlightOnHover
                      withTableBorder
                      withColumnBorders
                    >
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th />
                          {FIELDS.map((f) => (
                            <Table.Th key={f.key}>
                              {f.label.en}
                              <br />
                              {f.label.hi}
                            </Table.Th>
                          ))}
                          <Table.Th>Action</Table.Th>
                        </Table.Tr>
                      </Table.Thead>

                      <Table.Tbody>
                        {paginatedData.map((item, i) => {
                          const itemIndex = items.indexOf(item);
                          return (
                            <Table.Tr key={itemIndex}>
                              <Table.Td>
                                <input
                                  type="checkbox"
                                  checked={!!selectedRows[itemIndex]}
                                  onChange={() => handleToggleSelect(itemIndex)}
                                />
                              </Table.Td>
                              {FIELDS.map((f) => (
                                <Table.Td key={f.key}>
                                  {editIndex === itemIndex ? (
                                    <TextInput
                                      value={editData[f.key] || ''}
                                      onChange={(e) =>
                                        setEditData({
                                          ...editData,
                                          [f.key]: e.target.value
                                        })
                                      }
                                    />
                                  ) : (
                                    item[f.key] || '-'
                                  )}
                                </Table.Td>
                              ))}
                              <Table.Td>
                                {editIndex === itemIndex ? (
                                  <Group spacing="xs">
                                    <Button size="xs" onClick={() => handleSave(itemIndex)}>
                                      Save
                                    </Button>
                                    <Button size="xs" color="red" onClick={() => handleDeleteItem(itemIndex)}>
                                      Delete
                                    </Button>
                                  </Group>
                                ) : (
                                  <Group spacing="xs">
                                    <Button
                                      size="xs"
                                      onClick={() => {
                                        setEditIndex(itemIndex);
                                        setEditData(item);
                                      }}
                                    >
                                      Edit
                                    </Button>
                                    <Button size="xs" color="red" onClick={() => handleDeleteItem(itemIndex)}>
                                      Delete
                                    </Button>
                                  </Group>
                                )}
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                      </Table.Tbody>
                    </Table>
                  </div>
                )}

                <Group position="apart" mt="md">
                  <Button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Prev
                  </Button>
                  <Text>
                    {page} / {totalPages}
                  </Text>
                  <Button disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                    Next
                  </Button>
                </Group>
              </Card>
            </Tabs.Panel>
          ))}
        </Tabs>

        {message && <Alert>{message}</Alert>}
      </Stack>
    </Container>
  );
}

export default App;
