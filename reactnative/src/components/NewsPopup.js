import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  ImageBackground,
  TouchableOpacity,
  Pressable,
  Linking,
  Animated,
} from 'react-native';
import Svg, {Defs, LinearGradient as SvgLinearGradient, Rect, Stop} from 'react-native-svg';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useStore from '../store';
import {formatArticleContent} from '../utils/formatting';
import {fs} from '../utils/scale';

const TopGradient = () => (
  <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
    <Defs>
      <SvgLinearGradient id="newsTop" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#000" stopOpacity="0.95" />
        <Stop offset="0.55" stopColor="#000" stopOpacity="0.45" />
        <Stop offset="1" stopColor="#000" stopOpacity="0" />
      </SvgLinearGradient>
    </Defs>
    <Rect width="100%" height="100%" fill="url(#newsTop)" />
  </Svg>
);

const BottomGradient = () => (
  <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
    <Defs>
      <SvgLinearGradient id="newsBot" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#000" stopOpacity="0" />
        <Stop offset="0.35" stopColor="#000" stopOpacity="0.65" />
        <Stop offset="1" stopColor="#000" stopOpacity="0.97" />
      </SvgLinearGradient>
    </Defs>
    <Rect width="100%" height="100%" fill="url(#newsBot)" />
  </Svg>
);

const NewsPopup = () => {
  const visible = useStore((s) => s.newsPopupVisible);
  const article = useStore((s) => s.currentArticle);
  const hideArticle = useStore((s) => s.hideArticle);
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0.9);
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 18,
        stiffness: 220,
        mass: 0.8,
      }).start();
    }
  }, [visible, scale]);

  if (!article) {
    return null;
  }

  const hasImage = !!article.urlToImage;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      statusBarTranslucent={true}
      navigationBarTranslucent={true}
      onRequestClose={hideArticle}>
      <Pressable style={styles.overlay} onPress={hideArticle}>
        <Animated.View style={[styles.popup, {transform: [{scale}]}]}>
          <Pressable style={styles.popupInner} onPress={() => {}}>
            {hasImage ? (
              <ImageBackground
                source={{uri: article.urlToImage}}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : null}

            <View style={styles.topArea} pointerEvents="box-none">
              {hasImage ? <TopGradient /> : null}
              <View style={styles.header}>
                <Text style={styles.headerTitle} numberOfLines={3}>
                  {article.title}
                </Text>
                <TouchableOpacity onPress={hideArticle} hitSlop={10}>
                  <Icon name="close" size={26} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.bottomArea}>
              {hasImage ? <BottomGradient /> : null}
              <ScrollView
                style={styles.bottomScroll}
                contentContainerStyle={styles.bottomContent}
                showsVerticalScrollIndicator={false}>
                {article.description ? (
                  <Text style={styles.ingress}>
                    {formatArticleContent(article.description)}
                  </Text>
                ) : null}
                {article.content ? (
                  <Text style={styles.body}>
                    {formatArticleContent(article.content)}
                  </Text>
                ) : null}
                <TouchableOpacity
                  onPress={() => Linking.openURL(article.url)}
                  style={styles.linkWrap}>
                  <Text style={styles.link}>
                    Read full article at {article.source?.name}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popup: {
    width: '75%',
    height: '85%',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 24,
  },
  popupInner: {
    flex: 1,
  },
  topArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 8,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: fs(20),
    fontWeight: 'bold',
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 6,
  },
  bottomArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '70%',
  },
  bottomScroll: {
    paddingTop: 60,
  },
  bottomContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  ingress: {
    color: '#ffffff',
    fontSize: fs(16),
    fontStyle: 'italic',
    lineHeight: fs(22),
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  body: {
    color: '#dddddd',
    fontSize: fs(15),
    lineHeight: fs(22),
    marginBottom: 14,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  linkWrap: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  link: {
    color: '#7eb8e6',
    fontSize: fs(14),
    fontWeight: '600',
  },
});

export default NewsPopup;
