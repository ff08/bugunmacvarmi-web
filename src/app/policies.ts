export function renderPoliciesPage(): string {
  return `
    <section class="mx-auto max-w-3xl">
      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Politikalar</h1>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Bu sayfa; aydınlatma, gizlilik ve çerez kullanımına dair bilgilendirmeleri içerir.
        </p>

        <div class="mt-6 space-y-8">
          <section id="gizlilik">
            <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">Gizlilik Politikası</h2>
            <div class="mt-2 space-y-3 text-sm text-slate-700 dark:text-slate-300">
              <p>
                <span class="font-semibold">bugunmacvarmi.com</span> üzerinde; maç listelerini gösterebilmek için
                Google Sheets kaynaklı veriler çekilir ve sayfada görüntülenir.
              </p>
              <p>
                Bu sitede kullanıcı hesabı/üyelik yoktur. Zorunlu olmadıkça kimlik tanımlayıcı kişisel veri toplama hedeflenmez.
              </p>
              <p>
                Trafik ve performans iyileştirmeleri için tarayıcınızın sağladığı teknik bilgiler (ör. cihaz dili/saat dilimi) sadece
                yerel saat gösterimi gibi işlevler için kullanılır ve sunucuya özel olarak “profil” oluşturmak amacıyla işlenmez.
              </p>
            </div>
          </section>

          <section id="cerez">
            <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">Çerez Politikası</h2>
            <div class="mt-2 space-y-3 text-sm text-slate-700 dark:text-slate-300">
              <p>
                Sitemiz; deneyimi iyileştirmek için tarayıcınızda <span class="font-semibold">yerel depolama</span> (localStorage) kullanabilir.
                Bu, klasik “çerez” benzeri bir saklama alanıdır.
              </p>
              <ul class="list-disc pl-5">
                <li>
                  <span class="font-semibold">Zorunlu saklama</span>: Seçtiğiniz spor (Futbol/Basketbol) ve çerez tercihleri.
                </li>
                <li>
                  <span class="font-semibold">Performans/konfor</span>: Maç listesini kısa süreli önbelleğe alarak daha hızlı açılmasını sağlar.
                </li>
              </ul>
              <p>
                Çerez/yerel depolama tercihinizi dilediğiniz zaman aşağıdaki butondan değiştirebilirsiniz.
              </p>
              <button
                id="openCookiePrefs"
                class="mt-2 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Çerez Tercihlerini Yönet
              </button>
            </div>
          </section>

          <section id="iletisim">
            <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">İletişim</h2>
            <p class="mt-2 text-sm text-slate-700 dark:text-slate-300">
              Geri bildirim ve talepler için site üzerinden paylaştığınız iletişim kanallarını kullanabilirsiniz.
            </p>
          </section>
        </div>
      </div>
    </section>
  `;
}

