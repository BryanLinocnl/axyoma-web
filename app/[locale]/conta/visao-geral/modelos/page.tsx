'use client'

import { Boxes, Newspaper } from 'lucide-react'
import { useConta } from '@/lib/conta-context'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ModelsCatalog } from '@/components/modelos/models-catalog'
import { NewsFeed } from '@/components/modelos/news-feed'

export default function ModelosPage(): React.JSX.Element {
  const { token, userId, loading } = useConta()

  if (loading || !token || !userId) {
    return <p className="text-muted-foreground text-sm">Carregando…</p>
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Modelos</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Ative os modelos que quer usar no Axyoma IA Code e acompanhe as novidades do mercado. A seleção sincroniza
          automaticamente com o app.
        </p>
      </header>

      <Tabs defaultValue="catalogo">
        <TabsList>
          <TabsTrigger value="catalogo">
            <Boxes /> Catálogo
          </TabsTrigger>
          <TabsTrigger value="noticias">
            <Newspaper /> Notícias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalogo" className="mt-4">
          <ModelsCatalog userId={userId} />
        </TabsContent>

        <TabsContent value="noticias" className="mt-4">
          <NewsFeed />
        </TabsContent>
      </Tabs>
    </div>
  )
}
