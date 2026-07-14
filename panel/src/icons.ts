/**
 * O catálogo. TODA tela importa daqui, nunca de `@hugeicons/core-free-icons` direto.
 *
 * O motivo é o mesmo do resto do projeto: existe um lugar só onde a decisão mora. São
 * 13.624 ícones no pacote, e sem este arquivo a Home escolheria `UserGroup02` para
 * "clientes", a lista escolheria `UserMultiple03`, e o painel teria três desenhos
 * diferentes para a mesma coisa — cada um plausível, nenhum errado, e o conjunto
 * parecendo remendo.
 *
 * Os nomes aqui são o CONCEITO ("cliente"), não o desenho ("UserGroup02"). Trocar o
 * desenho depois é mudar uma linha.
 */
export {
  Alert02Icon as ALERT,
  ArrowDown01Icon as CARET,
  ArrowDown01Icon as SORT_DESC,
  ArrowReloadHorizontalIcon as REFRESH,
  ArrowRight01Icon as CHEVRON,
  ArrowUp01Icon as SORT_ASC,
  Search01Icon as SEARCH,
  Building03Icon as SUBACCOUNT,
  Cancel01Icon as CLOSE,
  Clock01Icon as CLOCK,
  Copy01Icon as COPY,
  CreditCardIcon as CARD,
  HelpCircleIcon as HELP,
  Home01Icon as HOME,
  InformationCircleIcon as INFO,
  Invoice01Icon as PAYMENT,
  MoneyReceive01Icon as ANTICIPATION,
  Moon02Icon as MOON,
  QrCode01Icon as PIX,
  ReceiptDollarIcon as STATEMENT,
  SharingIcon as SPLIT,
  Store01Icon as STORE,
  Sun02Icon as SUN,
  UserGroupIcon as CUSTOMER,
  WebhookIcon as WEBHOOK,
} from '@hugeicons/core-free-icons'
